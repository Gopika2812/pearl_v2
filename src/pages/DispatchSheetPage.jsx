import { useState } from "react";
import { FaBox, FaFilePdf, FaTruck } from "react-icons/fa";

/* ---------------- SAMPLE DATA ---------------- */
const deliveryData = [
  {
    id: 1,
    voucherType: "Sales",
    productGroup: "Electronics",
    warehouse: "Main",
    itemName: "LED Bulb",
    qtyPerItem: 10,
    totalQty: 100,
    customer: "Rahul",
    address: "12, MG Road, Bengaluru",
  },
  {
    id: 2,
    voucherType: "Sales",
    productGroup: "Groceries",
    warehouse: "Secondary",
    itemName: "Rice Bag",
    qtyPerItem: 5,
    totalQty: 50,
    customer: "Kannan",
    address: "45, Market St, Chennai",
  },
];

const purchaseData = [
  {
    id: 1,
    voucherType: "Purchase",
    productGroup: "Electronics",
    warehouse: "Main",
    itemName: "Mobile Charger",
    qtyPerItem: 20,
    totalQty: 200,
    vendor: "ABC Traders",
    address: "Industrial Area, Coimbatore",
  },
  {
    id: 2,
    voucherType: "Purchase",
    productGroup: "Groceries",
    warehouse: "Secondary",
    itemName: "Sugar",
    qtyPerItem: 10,
    totalQty: 100,
    vendor: "Fresh Foods",
    address: "Wholesale Market, Madurai",
  },
];

export default function DispatchSheetPage() {
  const [selectedDelivery, setSelectedDelivery] = useState([]);
  const [selectedPurchase, setSelectedPurchase] = useState([]);

  const toggleSelect = (id, list, setList) => {
    setList(list.includes(id) ? list.filter((i) => i !== id) : [...list, id]);
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pl-64 px-4 sm:px-6 space-y-8">

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-primary">
          Loading & Dispatch Sheet
        </h1>
        <p className="text-sm text-gray-500">
          Delivery & Purchase dispatch management
        </p>
      </div>

      {/* ================= DELIVERY ================= */}
      <Section
        title="Deliverying Products"
        icon={<FaTruck />}
        data={deliveryData}
        selected={selectedDelivery}
        setSelected={setSelectedDelivery}
        isDelivery
      />

      {/* ================= PURCHASE ================= */}
      <Section
        title="Purchasing Products"
        icon={<FaBox />}
        data={purchaseData}
        selected={selectedPurchase}
        setSelected={setSelectedPurchase}
      />
    </div>
  );
}

/* ---------------- REUSABLE SECTION ---------------- */
const Section = ({
  title,
  icon,
  data,
  selected,
  setSelected,
  isDelivery,
}) => {
  const toggleSelect = (id) => {
    setSelected(
      selected.includes(id)
        ? selected.filter((i) => i !== id)
        : [...selected, id]
    );
  };

  return (
    <section className="bg-white rounded-2xl shadow border p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 text-primary font-bold text-lg">
          {icon} {title}
        </div>

        <button
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm shadow hover:bg-primary/90 transition disabled:opacity-50"
          disabled={selected.length === 0}
        >
          <FaFilePdf />
          Generate Report
        </button>
      </div>

      {/* -------- DESKTOP TABLE -------- */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-primary/10 text-primary">
            <tr>
              <th className="px-3 py-2 text-center">✔</th>
              <th className="px-3 py-2 text-left">Voucher</th>
              <th className="px-3 py-2 text-left">Group</th>
              <th className="px-3 py-2 text-left">Warehouse</th>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-center">Qty / Item</th>
              <th className="px-3 py-2 text-center">Total Qty</th>
              <th className="px-3 py-2 text-left">
                {isDelivery ? "Customer" : "Vendor"}
              </th>
              <th className="px-3 py-2 text-left">Address</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={selected.includes(row.id)}
                    onChange={() => toggleSelect(row.id)}
                    className="accent-primary w-4 h-4"
                  />
                </td>
                <td className="px-3 py-2">{row.voucherType}</td>
                <td className="px-3 py-2">{row.productGroup}</td>
                <td className="px-3 py-2">{row.warehouse}</td>
                <td className="px-3 py-2 font-medium">
                  {row.itemName}
                </td>
                <td className="px-3 py-2 text-center">
                  {row.qtyPerItem}
                </td>
                <td className="px-3 py-2 text-center font-semibold">
                  {row.totalQty}
                </td>
                <td className="px-3 py-2">
                  {isDelivery ? row.customer : row.vendor}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {row.address}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* -------- MOBILE CARDS -------- */}
      <div className="md:hidden space-y-3">
        {data.map((row) => (
          <div
            key={row.id}
            className="border rounded-xl p-4 shadow-sm flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-primary">
                {row.itemName}
              </div>
              <input
                type="checkbox"
                checked={selected.includes(row.id)}
                onChange={() => toggleSelect(row.id)}
                className="accent-primary w-4 h-4"
              />
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <Field label="Voucher" value={row.voucherType} />
              <Field label="Group" value={row.productGroup} />
              <Field label="Warehouse" value={row.warehouse} />
              <Field label="Qty / Item" value={row.qtyPerItem} />
              <Field label="Total Qty" value={row.totalQty} />
              <Field
                label={isDelivery ? "Customer" : "Vendor"}
                value={isDelivery ? row.customer : row.vendor}
              />
            </div>

            <div className="text-xs text-gray-600">
              <span className="font-medium text-gray-700">Address:</span>{" "}
              {row.address}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

/* ---------------- FIELD UI ---------------- */
const Field = ({ label, value }) => (
  <div>
    <div className="text-xs text-gray-500">{label}</div>
    <div className="font-medium text-gray-800">{value}</div>
  </div>
);
