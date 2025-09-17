'use client'

import { useState, useEffect } from 'react'
import { Trophy, Medal, Star, Zap, Target, Crown, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api'
import { socketClient } from '@/lib/socket'

interface Mechanic {
  name: string
  total_points: number
  total_tasks: number
  rank: number
  medal: string
  updated_at: string
}

interface LeaderboardStats {
  total_mechanics: number
  total_points_awarded: number
  total_tasks_completed: number
  avg_points_per_mechanic: number
  highest_score: number
  top_mechanic: {
    name: string
    total_points: number
  } | null
}

const mechanicAvatars: { [key: string]: string } = {
  'IgenieroErick': '👨‍💻',
  'ChristianCobra': '🐍',
  'Chicanto': '🎵',
  'SpiderSteven': '🕷️',
  'LaBestiaPelua': '🦁',
  'PhonKing': '📱',
  'CarlosMariconGay': '🌈'
}

const rankGradients = [
  'from-yellow-400 via-yellow-500 to-orange-500', // Gold
  'from-gray-300 via-gray-400 to-gray-500',       // Silver
  'from-amber-600 via-amber-700 to-amber-800',    // Bronze
  'from-blue-500 via-purple-500 to-pink-500',     // 4th
  'from-green-400 via-blue-500 to-purple-600',    // 5th
  'from-indigo-500 via-purple-500 to-pink-500',   // 6th+
]

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<Mechanic[]>([])
  const [stats, setStats] = useState<LeaderboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLeaderboard()
    loadStats()

    // Socket listeners for real-time updates
    socketClient.on('task-added', loadLeaderboard)
    socketClient.on('task-updated', loadLeaderboard)
    socketClient.on('task-deleted', loadLeaderboard)

    return () => {
      socketClient.off('task-added', loadLeaderboard)
      socketClient.off('task-updated', loadLeaderboard)
      socketClient.off('task-deleted', loadLeaderboard)
    }
  }, [])

  const loadLeaderboard = async () => {
    try {
      const data = await api.getLeaderboard()
      setLeaderboard(data)
    } catch (error) {
      console.error('Error loading leaderboard:', error)
    }
  }

  const loadStats = async () => {
    try {
      const data = await api.getMechanicsStats()
      setStats(data)
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600 font-medium">Cargando ranking...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-3xl flex items-center justify-center mr-4 shadow-xl">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">🏆 Leaderboard de Mecánicos</h2>
              <p className="text-gray-600 text-lg">Ranking por puntos ganados</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Target className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Puntos</p>
                  <p className="text-xl font-bold text-gray-900">{stats.total_points_awarded}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tareas Totales</p>
                  <p className="text-xl font-bold text-gray-900">{stats.total_tasks_completed}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Crown className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Record</p>
                  <p className="text-xl font-bold text-gray-900">{stats.highest_score}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Promedio</p>
                  <p className="text-xl font-bold text-gray-900">{Math.round(stats.avg_points_per_mechanic)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top 3 Podium */}
        {leaderboard.length >= 3 && (
          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">🥇 Top 3 Champions</h3>
            <div className="flex justify-center items-end space-x-4">
              {/* 2nd Place */}
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-r from-gray-300 to-gray-500 rounded-3xl flex items-center justify-center mb-3 shadow-xl">
                  <span className="text-3xl">{mechanicAvatars[leaderboard[1]?.name] || '👤'}</span>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-lg border-2 border-gray-300 min-w-[140px]">
                  <div className="text-2xl mb-1">🥈</div>
                  <h4 className="font-bold text-gray-900 text-sm">{leaderboard[1]?.name}</h4>
                  <p className="text-lg font-bold text-gray-600">{leaderboard[1]?.total_points} pts</p>
                  <p className="text-xs text-gray-500">{leaderboard[1]?.total_tasks} tareas</p>
                </div>
              </div>

              {/* 1st Place */}
              <div className="text-center">
                <div className="w-28 h-28 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-3xl flex items-center justify-center mb-3 shadow-xl relative">
                  <span className="text-4xl">{mechanicAvatars[leaderboard[0]?.name] || '👤'}</span>
                  <div className="absolute -top-2 -right-2">
                    <Crown className="w-6 h-6 text-yellow-300" />
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-xl border-2 border-yellow-400 min-w-[160px]">
                  <div className="text-3xl mb-1">🥇</div>
                  <h4 className="font-bold text-gray-900">{leaderboard[0]?.name}</h4>
                  <p className="text-xl font-bold text-yellow-600">{leaderboard[0]?.total_points} pts</p>
                  <p className="text-sm text-gray-500">{leaderboard[0]?.total_tasks} tareas</p>
                </div>
              </div>

              {/* 3rd Place */}
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-r from-amber-600 to-amber-800 rounded-3xl flex items-center justify-center mb-3 shadow-xl">
                  <span className="text-3xl">{mechanicAvatars[leaderboard[2]?.name] || '👤'}</span>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-lg border-2 border-amber-600 min-w-[140px]">
                  <div className="text-2xl mb-1">🥉</div>
                  <h4 className="font-bold text-gray-900 text-sm">{leaderboard[2]?.name}</h4>
                  <p className="text-lg font-bold text-amber-600">{leaderboard[2]?.total_points} pts</p>
                  <p className="text-xs text-gray-500">{leaderboard[2]?.total_tasks} tareas</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Full Ranking */}
        <div className="bg-white rounded-3xl shadow-xl p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <Medal className="w-6 h-6 mr-2 text-yellow-500" />
            Ranking Completo
          </h3>

          <div className="space-y-3">
            {leaderboard.map((mechanic, index) => {
              const gradientIndex = Math.min(index, rankGradients.length - 1)
              const gradient = rankGradients[gradientIndex]

              return (
                <div key={mechanic.name} className={`relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 ${
                  index < 3 ? 'border-2' : 'border'
                } ${
                  index === 0 ? 'border-yellow-400' :
                  index === 1 ? 'border-gray-400' :
                  index === 2 ? 'border-amber-600' : 'border-gray-200'
                }`}>
                  <div className={`bg-gradient-to-r ${gradient} p-1`}>
                    <div className="bg-white rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          {/* Rank */}
                          <div className={`w-12 h-12 bg-gradient-to-r ${gradient} rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                            #{mechanic.rank}
                          </div>

                          {/* Avatar */}
                          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-2xl">
                            {mechanicAvatars[mechanic.name] || '👤'}
                          </div>

                          {/* Info */}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-bold text-gray-900 text-lg">{mechanic.name}</h4>
                              {mechanic.medal && <span className="text-2xl">{mechanic.medal}</span>}
                            </div>
                            <p className="text-sm text-gray-500">
                              {mechanic.total_tasks} tareas completadas
                            </p>
                          </div>
                        </div>

                        {/* Points */}
                        <div className="text-right">
                          <div className="flex items-center space-x-2 mb-1">
                            <Star className="w-5 h-5 text-yellow-500" />
                            <span className="text-2xl font-bold text-gray-900">{mechanic.total_points}</span>
                          </div>
                          <p className="text-sm text-gray-500">puntos</p>
                        </div>
                      </div>

                      {/* Progress bar for visual appeal */}
                      <div className="mt-4">
                        <div className="bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
                            style={{
                              width: `${Math.min((mechanic.total_points / (stats?.highest_score || 1)) * 100, 100)}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {leaderboard.length === 0 && (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Sin ranking disponible</h3>
              <p className="text-gray-500">Los mecánicos aparecerán aquí cuando completen tareas</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}