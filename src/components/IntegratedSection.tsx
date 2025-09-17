'use client'

import { useState, useEffect } from 'react'
import { Car, Plus, Check, Clock, AlertCircle, Trash2, Edit3, Zap } from 'lucide-react'
import { api } from '@/lib/api'
import { socketClient } from '@/lib/socket'
import CarModal from './cars/CarModal'

interface Car {
  id: number
  brand: string
  model: string
  year: number
  repair_time?: string
  start_date?: string
  status: 'pending' | 'in_progress' | 'completed' | 'delivered'
  created_at: string
  updated_at: string
}

interface Task {
  id: number
  car_id: number
  title: string
  description?: string
  assigned_mechanic?: string
  points: number
  status: 'pending' | 'in_progress' | 'completed'
  created_at: string
  updated_at: string
  completed_at?: string
}

const gradients = [
  'from-orange-400 via-pink-500 to-purple-600',
  'from-blue-500 via-purple-500 to-pink-500',
  'from-green-400 via-blue-500 to-purple-600',
  'from-yellow-400 via-red-500 to-pink-500',
  'from-indigo-500 via-purple-500 to-pink-500',
  'from-teal-400 via-blue-500 to-purple-600'
]

const mechanics = [
  'IgenieroErick',
  'ChristianCobra',
  'Chicanto',
  'SpiderSteven',
  'LaBestiaPelua',
  'PhonKing',
  'CarlosMariconGay'
]

const mechanicAvatars: { [key: string]: string } = {
  'IgenieroErick': '👨‍💻',
  'ChristianCobra': '🐍',
  'Chicanto': '🎵',
  'SpiderSteven': '🕷️',
  'LaBestiaPelua': '🦁',
  'PhonKing': '📱',
  'CarlosMariconGay': '🌈'
}

export default function IntegratedSection() {
  const [cars, setCars] = useState<Car[]>([])
  const [tasks, setTasks] = useState<{ [carId: number]: Task[] }>({})
  const [loading, setLoading] = useState(true)
  const [showCarModal, setShowCarModal] = useState(false)
  const [editingCar, setEditingCar] = useState<Car | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState<{ [carId: number]: string }>({})
  const [completingTaskMechanic, setCompletingTaskMechanic] = useState<{ [taskId: number]: string }>({})
  const [newTaskPoints, setNewTaskPoints] = useState<{ [carId: number]: number }>({})
  const [showNewTaskInput, setShowNewTaskInput] = useState<{ [carId: number]: boolean }>({})

  useEffect(() => {
    loadData()

    // Socket listeners
    socketClient.on('car-added', loadData)
    socketClient.on('car-updated', loadData)
    socketClient.on('car-deleted', loadData)
    socketClient.on('task-added', loadData)
    socketClient.on('task-updated', loadData)
    socketClient.on('task-deleted', loadData)

    return () => {
      socketClient.off('car-added', loadData)
      socketClient.off('car-updated', loadData)
      socketClient.off('car-deleted', loadData)
      socketClient.off('task-added', loadData)
      socketClient.off('task-updated', loadData)
      socketClient.off('task-deleted', loadData)
    }
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [carsData, allTasks] = await Promise.all([
        api.getCars(),
        api.getTasks()
      ])

      setCars(carsData)

      // Group tasks by car_id
      const tasksByCarId: { [carId: number]: Task[] } = {}
      allTasks.forEach((task: Task) => {
        if (!tasksByCarId[task.car_id]) {
          tasksByCarId[task.car_id] = []
        }
        tasksByCarId[task.car_id].push(task)
      })

      setTasks(tasksByCarId)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTask = async (carId: number) => {
    const title = newTaskTitle[carId]?.trim()
    if (!title) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3004'}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          car_id: carId,
          title,
          description: '',
          assigned_mechanic: null,
          points: newTaskPoints[carId] || 1
        })
      })

      if (response.ok) {
        // Clear inputs
        setNewTaskTitle(prev => ({ ...prev, [carId]: '' }))
        setNewTaskPoints(prev => ({ ...prev, [carId]: 1 }))
        setShowNewTaskInput(prev => ({ ...prev, [carId]: false }))

        // Reload data
        loadData()
      }
    } catch (error) {
      console.error('Error adding task:', error)
    }
  }

  const handleToggleTaskStatus = async (taskId: number, currentStatus: string) => {
    // If marking as completed, show mechanic selector first
    if (currentStatus !== 'completed') {
      setCompletingTaskMechanic(prev => ({ ...prev, [taskId]: '' }))
      return
    }

    // If unmarking completed, just toggle back to pending
    const newStatus = 'pending'

    try {
      await api.updateTask(taskId, {
        status: newStatus,
        assigned_mechanic: null
      })
      loadData() // Reload to get fresh data
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  const handleCompleteTask = async (taskId: number, mechanic: string) => {
    if (!mechanic) {
      alert('Por favor selecciona un mecánico')
      return
    }

    try {
      await api.updateTask(taskId, {
        status: 'completed',
        assigned_mechanic: mechanic
      })

      // Clear the mechanic selector
      setCompletingTaskMechanic(prev => {
        const updated = { ...prev }
        delete updated[taskId]
        return updated
      })

      loadData() // Reload to get fresh data
    } catch (error) {
      console.error('Error completing task:', error)
    }
  }

  const handleCancelCompletion = (taskId: number) => {
    setCompletingTaskMechanic(prev => {
      const updated = { ...prev }
      delete updated[taskId]
      return updated
    })
  }

  const handleDeleteTask = async (taskId: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
      try {
        // Update UI immediately
        setTasks(prev => {
          const newTasks = { ...prev }
          Object.keys(newTasks).forEach(carId => {
            newTasks[parseInt(carId)] = newTasks[parseInt(carId)].filter(task => task.id !== taskId)
          })
          return newTasks
        })

        await api.deleteTask(taskId)
      } catch (error) {
        console.error('Error deleting task:', error)
        loadData() // Reload if error
      }
    }
  }

  const handleDeleteCar = async (carId: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este carro? Esto eliminará también todas sus tareas.')) {
      try {
        await api.deleteCar(carId)
        // Reload data after successful deletion
        loadData()
      } catch (error) {
        console.error('Error deleting car:', error)
        // Reload data even if deletion failed to sync state
        loadData()
      }
    }
  }

  const handleSaveCar = async (carData: any) => {
    try {
      if (editingCar) {
        await api.updateCar(editingCar.id, carData)
      } else {
        await api.createCar(carData)
      }
      setShowCarModal(false)
      setEditingCar(null)
      loadData()
    } catch (error) {
      console.error('Error saving car:', error)
      throw error
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Car className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600 font-medium">Cargando taller...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="mb-4">
            <img
              src="/images/logo-astrobuild.png"
              alt="ASTROBUILD Tareas"
              className="w-auto"
              style={{
                height: '140px',
                transform: 'scale(4) translateX(-50px)',
                transformOrigin: 'left center',
                filter: 'drop-shadow(12px 12px 24px rgba(0,0,0,0.6))',
                maxWidth: 'none'
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-4xl font-black text-gray-800 tracking-wide"
                style={{
                  fontFamily: 'Anton, sans-serif',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
                  letterSpacing: '2px'
                }}>
              Tareas:
            </h2>
            <button
              onClick={() => setShowCarModal(true)}
              className="bg-black text-white px-6 py-3 rounded-2xl flex items-center space-x-2 font-semibold hover:bg-gray-800 transition-all duration-200 shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span>Nuevo Vehículo</span>
            </button>
          </div>
        </div>

        <div className="grid gap-6">
          {cars.map((car, index) => {
            const carTasks = tasks[car.id] || []
            const completedTasks = carTasks.filter(task => task.status === 'completed').length
            const totalTasks = carTasks.length
            const gradient = gradients[index % gradients.length]

            return (
              <div key={car.id} className="relative overflow-hidden rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300">
                {/* Gradient Header */}
                <div className={`bg-gradient-to-r ${gradient} p-6 text-white relative`}>
                  <div className="absolute inset-0 bg-black/10"></div>
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                          <Car className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold mb-1">
                            {car.brand} {car.model} {car.year}
                          </h3>
                          <p className="text-white/80 text-sm mb-3">
                            {car.repair_time && `⏱️ ${car.repair_time}`}
                            {car.start_date && ` • 📅 ${new Date(car.start_date).toLocaleDateString()}`}
                          </p>
                          <div className="flex items-center space-x-3">
                            <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                              <span className="text-xs font-semibold">
                                {car.status === 'pending' ? '⏳ Pendiente' :
                                 car.status === 'in_progress' ? '🔧 En Progreso' :
                                 car.status === 'completed' ? '✅ Completado' : '🎉 Entregado'}
                              </span>
                            </div>
                            {totalTasks > 0 && (
                              <div className="flex items-center space-x-2 text-sm">
                                <Zap className="w-4 h-4" />
                                <span className="font-semibold">{completedTasks}/{totalTasks}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setEditingCar(car)}
                          className="p-2 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-colors"
                          title="Editar vehículo"
                        >
                          <Edit3 className="w-4 h-4 text-white" />
                        </button>
                        <button
                          onClick={() => handleDeleteCar(car.id)}
                          className="p-2 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-red-500/30 transition-colors"
                          title="Eliminar vehículo"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tasks Section */}
                <div className="bg-white rounded-t-3xl p-6 -mt-6 relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-900 text-lg">📝 Tareas</h4>
                    <button
                      onClick={() => setShowNewTaskInput(prev => ({ ...prev, [car.id]: !prev[car.id] }))}
                      className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center space-x-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Nueva</span>
                    </button>
                  </div>

                  {/* Add new task input */}
                  {showNewTaskInput[car.id] && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-200">
                      <div className="space-y-3">
                        {/* Task title */}
                        <input
                          type="text"
                          value={newTaskTitle[car.id] || ''}
                          onChange={(e) => setNewTaskTitle(prev => ({ ...prev, [car.id]: e.target.value }))}
                          placeholder="Ej: Cambiar aceite, Revisar frenos..."
                          className="w-full px-4 py-3 bg-white border-0 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 shadow-sm"
                          onKeyPress={(e) => e.key === 'Enter' && handleAddTask(car.id)}
                        />

                        {/* Points selection */}
                        <div className="w-32">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Puntos de la tarea</label>
                          <select
                            value={newTaskPoints[car.id] || 1}
                            onChange={(e) => setNewTaskPoints(prev => ({ ...prev, [car.id]: parseInt(e.target.value) }))}
                            className="w-full px-3 py-2 bg-white border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 shadow-sm"
                          >
                            <option value={1}>1 ⭐</option>
                            <option value={2}>2 ⭐</option>
                            <option value={3}>3 ⭐</option>
                            <option value={5}>5 ⭐</option>
                            <option value={10}>10 ⭐</option>
                          </select>
                        </div>

                        {/* Action buttons */}
                        <div className="flex space-x-3">
                          <button
                            onClick={() => handleAddTask(car.id)}
                            className="flex-1 py-3 bg-black text-white text-sm rounded-xl hover:bg-gray-800 font-semibold"
                          >
                            ✅ Crear Tarea
                          </button>
                          <button
                            onClick={() => setShowNewTaskInput(prev => ({ ...prev, [car.id]: false }))}
                            className="px-6 py-3 text-gray-600 text-sm bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
                          >
                            ❌
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tasks list */}
                  <div className="space-y-3">
                    {carTasks.length > 0 ? (
                      carTasks.map((task) => (
                        <div key={task.id} className={`group p-4 rounded-2xl border transition-all duration-200 hover:shadow-md ${
                          task.status === 'completed'
                            ? 'bg-green-50 border-green-200'
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4 flex-1">
                              <button
                                onClick={() => handleToggleTaskStatus(task.id, task.status)}
                                className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                                  task.status === 'completed'
                                    ? 'bg-green-500 border-green-500 text-white shadow-lg'
                                    : 'border-gray-300 hover:border-green-400 hover:bg-green-50'
                                }`}
                              >
                                {task.status === 'completed' && <Check className="w-4 h-4" />}
                              </button>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <p className={`font-medium ${
                                    task.status === 'completed' ? 'line-through text-green-600' : 'text-gray-900'
                                  }`}>
                                    {task.title}
                                  </p>
                                  <div className="flex items-center space-x-1">
                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
                                      {task.points} pts
                                    </span>
                                  </div>
                                </div>
                                {task.assigned_mechanic && (
                                  <div className="flex items-center space-x-2 mt-1">
                                    <span className="text-xs text-gray-500">Asignado a:</span>
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                                      {mechanicAvatars[task.assigned_mechanic]} {task.assigned_mechanic}
                                    </span>
                                  </div>
                                )}
                                {task.description && (
                                  <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200"
                              title="Eliminar tarea"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Mechanic selection when completing task */}
                          {completingTaskMechanic[task.id] !== undefined && (
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                              <div className="flex items-center space-x-2 mb-3">
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                  <Check className="w-4 h-4 text-white" />
                                </div>
                                <span className="font-medium text-blue-800">
                                  ¿Qué mecánico completó esta tarea?
                                </span>
                              </div>

                              <div className="flex items-center space-x-3">
                                <select
                                  value={completingTaskMechanic[task.id] || ''}
                                  onChange={(e) => setCompletingTaskMechanic(prev => ({
                                    ...prev,
                                    [task.id]: e.target.value
                                  }))}
                                  className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Seleccionar mecánico...</option>
                                  {mechanics.map(mechanic => (
                                    <option key={mechanic} value={mechanic}>
                                      {mechanicAvatars[mechanic]} {mechanic}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  onClick={() => handleCompleteTask(task.id, completingTaskMechanic[task.id])}
                                  className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
                                >
                                  ✅ Completar
                                </button>

                                <button
                                  onClick={() => handleCancelCompletion(task.id)}
                                  className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-400 transition-colors"
                                >
                                  ❌ Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Check className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-600 font-medium">Sin tareas asignadas</p>
                        <p className="text-sm text-gray-500 mt-1">Agrega la primera tarea para este vehículo</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {cars.length === 0 && (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                <Car className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">¡Bienvenido al Taller!</h3>
              <p className="text-gray-600 mb-8 text-lg">Comienza registrando tu primer vehículo</p>
              <button
                onClick={() => setShowCarModal(true)}
                className="bg-black text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-gray-800 transition-all duration-200 shadow-lg flex items-center space-x-3 mx-auto"
              >
                <Plus className="w-6 h-6" />
                <span>Registrar Primer Vehículo</span>
              </button>
            </div>
          )}
        </div>

        {/* Car Modal */}
        {(showCarModal || editingCar) && (
          <CarModal
            isOpen={showCarModal || !!editingCar}
            onClose={() => {
              setShowCarModal(false)
              setEditingCar(null)
            }}
            onSave={handleSaveCar}
            car={editingCar}
          />
        )}
      </div>
    </div>
  )
}