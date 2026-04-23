export default function Tasks() {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Tasks</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          + New Task
        </button>
      </div>
      <div className="bg-white rounded-lg border shadow-sm p-8 text-center text-gray-500">
        No tasks yet.
      </div>
    </div>
  )
}
