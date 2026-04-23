export default function Settings() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      <div className="bg-white rounded-lg border shadow-sm p-6 max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Tenant Name</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="My Team" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Model Config</label>
            <textarea className="mt-1 w-full border rounded-lg px-3 py-2 h-32 font-mono text-sm" placeholder="# models.yaml" />
          </div>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
