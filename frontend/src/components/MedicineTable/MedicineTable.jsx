const MedicineTable = ({ medicines }) => {
  if (!medicines || medicines.length === 0) {
    return <p>No medicines extracted.</p>;
  }

  return (
    <table className="w-full border">
      <thead className="bg-gray-100">
        <tr>
          <th className="p-2 text-left">Medicine</th>
          <th className="p-2 text-left">Dosage</th>
          <th className="p-2 text-left">Frequency</th>
          <th className="p-2 text-left">Status</th>
        </tr>
      </thead>

      <tbody>
        {medicines.map((med, idx) => (
          <tr key={idx} className="border-t">
            <td className="p-2">{med.medicine_name}</td>
            <td className="p-2">{med.dosage || "—"}</td>
            <td className="p-2">{med.frequency || "—"}</td>
            <td className="p-2">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                Extracted
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default MedicineTable;
