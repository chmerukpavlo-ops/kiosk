// Chart export utility - export charts as PNG/PDF images

/**
 * Export a chart element as PNG image
 */
export async function exportChartAsPNG(
  chartElement: HTMLElement | null,
  filename: string = 'chart'
): Promise<void> {
  if (!chartElement) {
    throw new Error('Chart element not found');
  }

  try {
    // Use html2canvas if available, otherwise use canvas API
    const html2canvas = (window as any).html2canvas;
    
    if (html2canvas) {
      // Use html2canvas library for better quality
      const canvas = await html2canvas(chartElement, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
      });

      // Convert canvas to blob and download
      canvas.toBlob((blob: Blob | null) => {
        if (!blob) {
          throw new Error('Failed to create image blob');
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}_${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } else {
      // Fallback: use SVG to PNG conversion
      await exportSVGAsPNG(chartElement, filename);
    }
  } catch (error: any) {
    console.error('Chart export error:', error);
    throw new Error('Помилка експорту графіка: ' + (error.message || 'Невідома помилка'));
  }
}

/**
 * Export SVG chart as PNG (fallback method)
 */
async function exportSVGAsPNG(element: HTMLElement, filename: string): Promise<void> {
  // Find SVG element
  const svg = element.querySelector('svg');
  if (!svg) {
    throw new Error('SVG element not found in chart');
  }

  // Clone SVG to avoid modifying original
  const clonedSvg = svg.cloneNode(true) as SVGElement;
  
  // Get computed styles
  const styles = window.getComputedStyle(element);
  const bgColor = styles.backgroundColor || '#ffffff';
  
  // Set background if needed
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('width', '100%');
  rect.setAttribute('height', '100%');
  rect.setAttribute('fill', bgColor);
  clonedSvg.insertBefore(rect, clonedSvg.firstChild);

  // Convert SVG to data URL
  const svgData = new XMLSerializer().serializeToString(clonedSvg);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  // Create image and convert to canvas
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw image
    ctx.drawImage(img, 0, 0);

    // Download
    canvas.toBlob((blob: Blob | null) => {
      if (!blob) {
        throw new Error('Failed to create image blob');
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}_${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      URL.revokeObjectURL(svgUrl);
    }, 'image/png');
  };

  img.onerror = () => {
    throw new Error('Failed to load SVG image');
  };

  img.src = svgUrl;
}

/**
 * Export chart as PDF (using jsPDF if available)
 */
export async function exportChartAsPDF(
  chartElement: HTMLElement | null,
  filename: string = 'chart',
  title?: string
): Promise<void> {
  if (!chartElement) {
    throw new Error('Chart element not found');
  }

  try {
    // First export as PNG
    const html2canvas = (window as any).html2canvas;
    const jsPDF = (window as any).jspdf?.jsPDF;

    if (html2canvas && jsPDF) {
      const canvas = await html2canvas(chartElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      
      const imgWidth = 297; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Add title if provided
      if (title) {
        pdf.setFontSize(16);
        pdf.text(title, 14, 10);
        pdf.addImage(imgData, 'PNG', 10, 15, imgWidth - 20, imgHeight - 10);
      } else {
        pdf.addImage(imgData, 'PNG', 10, 10, imgWidth - 20, imgHeight);
      }

      pdf.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
    } else {
      // Fallback: export as PNG and suggest PDF conversion
      await exportChartAsPNG(chartElement, filename);
      throw new Error('PDF експорт потребує додаткових бібліотек. Експортовано як PNG.');
    }
  } catch (error: any) {
    // If PDF fails, try PNG
    if (error.message.includes('PDF')) {
      throw error;
    }
    await exportChartAsPNG(chartElement, filename);
    throw error;
  }
}

/**
 * Hook for chart export functionality
 */
export function useChartExport(chartRef: React.RefObject<HTMLDivElement>) {
  const exportAsPNG = async (filename: string) => {
    if (!chartRef.current) {
      throw new Error('Chart ref not available');
    }
    await exportChartAsPNG(chartRef.current, filename);
  };

  const exportAsPDF = async (filename: string, title?: string) => {
    if (!chartRef.current) {
      throw new Error('Chart ref not available');
    }
    await exportChartAsPDF(chartRef.current, filename, title);
  };

  return { exportAsPNG, exportAsPDF };
}

