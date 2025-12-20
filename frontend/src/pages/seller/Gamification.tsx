import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { toast } from '../../components/Toast';

interface Achievement {
  id: number;
  code: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  category: string;
  earned: boolean;
  earned_at?: string;
}

interface GamificationData {
  achievements: Achievement[];
  earned: Achievement[];
  stats: {
    today: {
      sales: number;
      revenue: number;
    };
    total_points: number;
  };
  daily_goal: {
    sales_target: number;
    revenue_target: number;
    sales_actual: number;
    revenue_actual: number;
    completed: boolean;
  } | null;
}

export function Gamification() {
  const [data, setData] = useState<GamificationData | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [salesTarget, setSalesTarget] = useState(0);
  const [revenueTarget, setRevenueTarget] = useState(0);

  useEffect(() => {
    loadData();
    loadLeaderboard();
  }, [period]);

  const loadData = async () => {
    try {
      const response = await api.get('/gamification/achievements');
      setData(response.data);
      
      // Set goal inputs if goal exists
      if (response.data.daily_goal) {
        setSalesTarget(response.data.daily_goal.sales_target || 0);
        setRevenueTarget(response.data.daily_goal.revenue_target || 0);
      }
    } catch (error: any) {
      console.error('Failed to load gamification data:', error);
      toast.error('Помилка завантаження даних');
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const response = await api.get(`/gamification/leaderboard?period=${period}`);
      setLeaderboard(response.data);
    } catch (error: any) {
      console.error('Failed to load leaderboard:', error);
    }
  };

  const handleSetGoal = async () => {
    try {
      await api.post('/gamification/daily-goal', {
        sales_target: salesTarget,
        revenue_target: revenueTarget,
      });
      toast.success('Ціль встановлено!');
      setShowGoalModal(false);
      loadData();
    } catch (error: any) {
      toast.error('Помилка встановлення цілі');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Завантаження...</p>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-gray-500 dark:text-gray-400">Помилка завантаження даних</div>;
  }

  const categories = ['sales', 'revenue', 'streak', 'ranking'];
  const categoryLabels: Record<string, string> = {
    sales: 'Продажі',
    revenue: 'Виручка',
    streak: 'Серії',
    ranking: 'Рейтинг',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Гейміфікація</h1>
        <button
          onClick={() => setShowGoalModal(true)}
          className="btn btn-primary"
        >
          🎯 Встановити ціль на день
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="text-sm opacity-90 mb-1">Продажів сьогодні</div>
          <div className="text-2xl font-bold">{data.stats.today.sales}</div>
          {data.daily_goal && (
            <div className="text-xs mt-2 opacity-80">
              Ціль: {data.daily_goal.sales_target} ({Math.round((data.stats.today.sales / data.daily_goal.sales_target) * 100)}%)
            </div>
          )}
        </div>
        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="text-sm opacity-90 mb-1">Виручка сьогодні</div>
          <div className="text-2xl font-bold">{data.stats.today.revenue.toFixed(2)} ₴</div>
          {data.daily_goal && (
            <div className="text-xs mt-2 opacity-80">
              Ціль: {data.daily_goal.revenue_target.toFixed(2)} ₴ ({Math.round((data.stats.today.revenue / data.daily_goal.revenue_target) * 100)}%)
            </div>
          )}
        </div>
        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="text-sm opacity-90 mb-1">Всього балів</div>
          <div className="text-2xl font-bold">{data.stats.total_points}</div>
          <div className="text-xs mt-2 opacity-80">
            {data.earned.length} досягнень
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 dark:text-gray-100">Досягнення</h2>
        <div className="space-y-6">
          {categories.map((category) => {
            const categoryAchievements = data.achievements.filter(a => a.category === category);
            if (categoryAchievements.length === 0) return null;

            return (
              <div key={category}>
                <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {categoryLabels[category]}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryAchievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        achievement.earned
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-600'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-3xl">{achievement.icon}</div>
                        {achievement.earned && (
                          <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">
                            ✅ Отримано
                          </span>
                        )}
                      </div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        {achievement.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {achievement.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-500">
                          {achievement.points} балів
                        </span>
                        {achievement.earned && achievement.earned_at && (
                          <span className="text-xs text-gray-500 dark:text-gray-500">
                            {new Date(achievement.earned_at).toLocaleDateString('uk-UA')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold dark:text-gray-100">Рейтинг продавців</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === 'today'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              День
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === 'week'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Тиждень
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === 'month'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Місяць
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {leaderboard.map((seller, index) => (
            <div
              key={seller.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                index === 0
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-500 dark:border-yellow-600'
                  : index === 1
                  ? 'bg-gray-50 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600'
                  : index === 2
                  ? 'bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-400 dark:border-orange-600'
                  : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  index === 0 ? 'bg-yellow-500 text-white' :
                  index === 1 ? 'bg-gray-400 text-white' :
                  index === 2 ? 'bg-orange-500 text-white' :
                  'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}>
                  {index + 1}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{seller.full_name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {seller.sales_count} продажів • {parseFloat(seller.revenue || 0).toFixed(2)} ₴
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                  {parseInt(seller.total_points || 0)} балів
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold mb-4 dark:text-gray-100">Встановити ціль на день</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Ціль продажів</label>
                <input
                  type="number"
                  value={salesTarget}
                  onChange={(e) => setSalesTarget(parseInt(e.target.value) || 0)}
                  className="input"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Ціль виручки (₴)</label>
                <input
                  type="number"
                  step="0.01"
                  value={revenueTarget}
                  onChange={(e) => setRevenueTarget(parseFloat(e.target.value) || 0)}
                  className="input"
                  min="0"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowGoalModal(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                Скасувати
              </button>
              <button
                onClick={handleSetGoal}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
              >
                Зберегти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

