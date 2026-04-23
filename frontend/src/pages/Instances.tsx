export default function Instances() {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Instances</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          + Create Instance
        </button>
      </div>
      <div className="bg-white rounded-lg border shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4">Name</th>
              <th className="p-4">Status</th>
              <th className="p-4">Tier</th>
              <th className="p-4">Created</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="p-8 text-center text-gray-500">
                No instances yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
