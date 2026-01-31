import axios from "axios";
import { Fragment, useEffect, useState } from "react";
import {
  FaChevronDown,
  FaChevronUp,
  FaFileInvoice,
} from "react-icons/fa";
import { API_BASE } from "../api";


const API = `${API_BASE}/pearls-book`;

export default function PearlsBookPage() {
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    axios.get(API).then((res) => setRows(res.data));
  }, []);

  const generateInvoice = async (id) => {
    try {
      const res = await axios.post(`${API}/generate-invoice/${id}`);

      // 🔔 LOW STOCK ALERT
      if (res.data.lowStockAlerts?.length) {
        const msg = res.data.lowStockAlerts
          .map(
            (a) =>
              `⚠️ LOW STOCK\n${a.product}\nWarehouse: ${a.warehouse}\nRemaining: ${a.remainingQty}`
          )
          .join("\n\n");

        alert(msg);
      }

      window.open(res.data.waUrl, "_blank");
    } catch (err) {
      alert(err.response?.data?.message || "Invoice generation failed");
    }
  };




  return (
    <div className="min-h-screen bg-gray-100 pt-20 md:pl-64 px-3 sm:px-6">
      {/* HEADER */}
      <div className="mb-6 max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-bold text-primary">
          Pearls Book
        </h1>
        <p className="text-sm text-gray-500">
          Purchase & Sales Register
        </p>
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden md:block max-w-[1400px] mx-auto bg-white rounded-2xl shadow border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-primary text-white sticky top-0 z-10">
            <tr>
              <th className="w-10 px-3 py-3"></th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Invoice</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Party</th>
              <th className="px-4 py-3 text-left">Warehouse</th>
              <th className="px-4 py-3 text-right">Subtotal</th>
              <th className="px-4 py-3 text-right">Tax</th>
              <th className="px-4 py-3 text-right">Transport</th>
              <th className="px-4 py-3 text-right">Grand Total</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <Fragment key={r._id}>
                <tr className="border-b even:bg-gray-50 hover:bg-primary/5 transition">
                  <td className="text-center px-3 py-3">
                    <button
                      onClick={() =>
                        setExpanded(expanded === r._id ? null : r._id)
                      }
                      className="text-gray-600 hover:text-primary"
                    >
                      {expanded === r._id ? (
                        <FaChevronUp />
                      ) : (
                        <FaChevronDown />
                      )}
                    </button>
                  </td>

                  <td className="px-4 py-3">
                    {new Date(r.date).toLocaleDateString()}
                  </td>

                  <td className="px-4 py-3 font-semibold text-gray-800">
                    {r.invoiceId}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${r.type === "SALES"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                        }`}
                    >
                      {r.type}
                    </span>
                  </td>

                  <td className="px-4 py-3">{r.party}</td>
                  <td className="px-4 py-3">{r.warehouse}</td>

                  <td className="px-4 py-3 text-right">
                    ₹{r.subtotal}
                  </td>
                  <td className="px-4 py-3 text-right">
                    ₹{r.totalTax}
                  </td>
                  <td className="px-4 py-3 text-right">
                    ₹{r.transportCharge}
                  </td>

                  <td className="px-4 py-3 text-right font-bold text-primary text-base">
                    ₹{r.grandTotal}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {r.type === "SALES" && (
                      <button
                        onClick={() => generateInvoice(r._id)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-semibold hover:bg-primary hover:text-white transition text-xs"
                      >
                        <FaFileInvoice />
                        Generate
                      </button>
                    )}
                  </td>
                </tr>

                {/* EXPANDED ROW */}
                {expanded === r._id && (
                  <tr>
                    <td colSpan="11" className="bg-primary/5 px-6 py-4">
                      <div className="bg-white rounded-xl shadow-sm border p-4">
                        <ExpandedItems row={r} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* MOBILE VIEW (UNCHANGED – ALREADY GOOD) */}
      <div className="md:hidden space-y-3">
        {rows.map((r) => (
          <div
            key={r._id}
            className="bg-white rounded-xl shadow border p-4"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">
                {new Date(r.date).toLocaleDateString()}
              </span>
              <span
                className={`text-xs font-bold px-2 py-1 rounded-full ${r.type === "SALES"
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700"
                  }`}
              >
                {r.type}
              </span>
            </div>

            <div className="mt-2 font-semibold">
              {r.invoiceId}
            </div>

            <div className="text-sm text-gray-600">
              {r.party}
            </div>

            <div className="grid grid-cols-2 text-sm gap-2 mt-3">
              <div>
                <span className="text-gray-500">Total</span>
                <div className="font-bold text-primary">
                  ₹{r.grandTotal}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Warehouse</span>
                <div>{r.warehouse}</div>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() =>
                  setExpanded(expanded === r._id ? null : r._id)
                }
                className="flex-1 border rounded-lg py-2 text-sm"
              >
                {expanded === r._id ? "Hide Items" : "View Items"}
              </button>

              {r.type === "SALES" && (
                <button className="flex-1 bg-primary text-white rounded-lg py-2 text-sm">
                  Invoice
                </button>
              )}
            </div>

            {expanded === r._id && (
              <div className="mt-3">
                <ExpandedItems row={r} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>


  );
}

function ExpandedItems({ row }) {
  const isSales = row.type === "SALES";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border rounded-lg overflow-hidden">
        <thead className="bg-primary/10 text-primary">
          <tr>
            <th className="px-3 py-2 text-left">Item</th>
            <th className="px-3 py-2">HSN</th>
            <th className="px-3 py-2 text-right">Price</th>
            <th className="px-3 py-2 text-right">Qty</th>
            {isSales && (
              <th className="px-3 py-2 text-right">Discount</th>
            )}
            <th className="px-3 py-2 text-right">GST</th>
            <th className="px-3 py-2 text-right">Total</th>
          </tr>
        </thead>

        <tbody>
          {row.items.map((i, idx) => (
            <tr key={idx} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2">
                <div className="font-semibold">{i.name}</div>
                <div className="text-[11px] text-gray-500">
                  {i.productGroup}
                </div>
              </td>

              <td className="px-3 py-2">{i.hsn}</td>

              <td className="px-3 py-2 text-right">
                ₹{isSales ? i.sellingPrice : i.purchasePrice}
              </td>

              <td className="px-3 py-2 text-right">{i.qty}</td>

              {isSales && (
                <td className="px-3 py-2 text-right">
                  {i.discountType === "PERCENT"
                    ? `${i.discountPercent}%`
                    : `₹${i.discountAmount}`}
                </td>
              )}

              <td className="px-3 py-2 text-right">{i.gst}%</td>

              <td className="px-3 py-2 text-right font-bold text-primary">
                ₹{i.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* E-WAY BILL */}
      {isSales && row.ewayEnabled && (
        <div className="mt-4 text-xs bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <strong>E-Way Bill:</strong>{" "}
          {row.ewayDetails?.ewayBillNo} <br />
          Vehicle No: {row.ewayDetails?.vehicleNo}
        </div>
      )}
    </div>
  );
}

