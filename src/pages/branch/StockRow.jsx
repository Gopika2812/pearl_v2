import React from 'react';
import { FaSave, FaTrash } from 'react-icons/fa';

/**
 * StockRow renders a single row in the stock table.
 * Props:
 * - row: object containing row data
 * - updateRow: (rowId, field, value) => void
 * - saveRow: (row) => void
 */
export default function StockRow({ row, updateRow, saveRow }) {
  const handleChange = (field) => (e) => {
    const value = e.target.value;
    updateRow(row.rowId, field, value);
  };

  const handleSave = () => saveRow(row);

  return (
    <>
      <td className="px-2 py-1.5 text-[10px]" title={row.productName}>
        {row.productName}
      </td>
      <td className="px-2 py-1.5 text-center text-[10px]">{row.systemQty}</td>
      <td className="px-2 py-1.5 text-center text-[10px]">{row.damagedQty || 0}</td>
      <td className="px-2 py-1.5 text-center text-[10px]">{row.expiredQty || 0}</td>
      <td className="px-2 py-1.5 text-center">
        <input
          type="text"
          className="w-full text-center text-[9px] bg-gray-50 border border-gray-300 rounded"
          value={row.physicalQty === 'NO_ACTION' ? 'NO ACTION' : row.physicalQty}
          onChange={handleChange('physicalQty')}
        />
      </td>
      <td className="px-2 py-1.5 text-center text-[10px]">
        {Number(row.mrp) === 0 ? '' : row.mrp}
      </td>
      <td className="px-2 py-1.5 text-[10px]" title={row.batch}>
        {row.batch === 'NO_ACTION' ? 'NO ACTION' : row.batch || ''}
      </td>
      <td className="px-2 py-1.5 text-center text-[10px]">
        {row.expiryDate || ''}
      </td>
      <td className="px-2 py-1.5 text-[9px]">
        {row.checkedBy.map((u) => u.username || u.fullName).join(', ')}
      </td>
      <td className="px-1 py-1 flex items-center justify-center space-x-1">
        {row.saving ? (
          <span className="text-xs text-gray-500">Saving...</span>
        ) : (
          <button onClick={handleSave} className="text-green-600 hover:text-green-800">
            <FaSave size={10} />
          </button>
        )}
        {/* Delete button placeholder, can be implemented later */}
        <button className="text-red-600 hover:text-red-800" disabled>
          <FaTrash size={10} />
        </button>
      </td>
    </>
  );
}
