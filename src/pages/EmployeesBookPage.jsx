import { useState } from "react";
import { FaPlus, FaUsers } from "react-icons/fa";

/* ---------------- SAMPLE DATA ---------------- */
const sampleEmployees = [
  {
    id: "MAN001",
    name: "Arun Kumar",
    phone: "9876543210",
    email: "arun@pearls.com",
    department: "Manager",
    shiftStart: "09:00",
    shiftEnd: "18:00",
    saraly: "50000",
    image: "https://i.pravatar.cc/150?img=12",
  },
  {
    id: "BILL002",
    name: "Sangeetha",
    phone: "9123456780",
    email: "sangeetha@pearls.com",
    department: "Billing",
    shiftStart: "10:00",
    shiftEnd: "19:00",
    salary: "40000",
    image: "https://i.pravatar.cc/150?img=32",
  },
  {
    id: "DEL003",
    name: "Ravi",
    phone: "9988776655",
    email: "ravi@pearls.com",
    department: "Delivery",
    shiftStart: "08:00",
    shiftEnd: "17:00",
    salary: "35000",
    image: "https://i.pravatar.cc/150?img=56",
  },
  {
    id: "MAR004",
    name: "Meena",
    phone: "9090909090",
    email: "meena@pearls.com",
    department: "Marketing & Sales",
    shiftStart: "09:30",
    shiftEnd: "18:30",
    salary: "45000",
    image: "https://i.pravatar.cc/150?img=41",
  },
];

/* ---------------- DEPARTMENTS ---------------- */
const departments = [
  "All",
  "Manager",
  "Billing",
  "Delivery",
  "Dispatch",
  "Marketing & Sales",
];

export default function EmployeesBookPage() {
  const [employees, setEmployees] = useState(sampleEmployees);
  const [filterDept, setFilterDept] = useState("All");
  const [showModal, setShowModal] = useState(false);

  const filtered =
    filterDept === "All"
      ? employees
      : employees.filter((e) => e.department === filterDept);

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pl-20 px-4 sm:px-6 space-y-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            Employees Book
          </h1>
          <p className="text-sm text-gray-500">
            Manage employees department-wise
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
          >
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm shadow hover:bg-primary/90 transition"
          >
            <FaPlus />
            Add Employee
          </button>
        </div>
      </div>

      {/* DEPARTMENT SUMMARY */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {departments
          .filter((d) => d !== "All")
          .map((dept) => (
            <div
              key={dept}
              className="bg-white rounded-xl shadow border p-4 text-center"
            >
              <div className="text-sm text-gray-500">
                {dept}
              </div>
              <div className="text-xl font-bold text-primary">
                {
                  employees.filter(
                    (e) => e.department === dept
                  ).length
                }
              </div>
            </div>
          ))}
      </div>

      {/* EMPLOYEE CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((emp) => (
          <EmployeeCard key={emp.id} emp={emp} />
        ))}
      </div>

      {/* ADD EMPLOYEE MODAL */}
      {showModal && (
        <AddEmployeeModal
          onClose={() => setShowModal(false)}
          onAdd={(newEmp) =>
            setEmployees([...employees, newEmp])
          }
        />
      )}
    </div>
  );
}

/* ---------------- EMPLOYEE CARD ---------------- */
const EmployeeCard = ({ emp }) => (
  <div className="bg-white rounded-2xl shadow border p-5 flex flex-col gap-3 hover:shadow-lg transition">
    <div className="flex items-center gap-3">
      <img
        src={emp.image}
        alt={emp.name}
        className="w-14 h-14 rounded-full border"
      />
      <div>
        <div className="font-semibold text-primary">
          {emp.name}
        </div>
        <div className="text-xs text-gray-500">
          {emp.id}
        </div>
      </div>
    </div>

    <div className="text-sm space-y-1">
      <div>
        <span className="text-gray-500">Dept:</span>{" "}
        <span className="font-medium">
          {emp.department}
        </span>
      </div>
      <div>
        <span className="text-gray-500">Phone:</span>{" "}
        {emp.phone}
      </div>
      <div>
        <span className="text-gray-500">Email:</span>{" "}
        {emp.email}
      </div>
      <div>
        <span className="text-gray-500">Shift:</span>{" "}
        {emp.shiftStart} - {emp.shiftEnd}
      </div>
      <div>
        <span className="text-gray-500">Salary:</span>{" "}
        {emp.salary}
      </div>
    </div>

    <button className="mt-auto border border-primary text-primary rounded-lg py-2 text-sm hover:bg-primary/10 transition">
      View Profile
    </button>
  </div>
);

/* ---------------- ADD EMPLOYEE MODAL ---------------- */
const AddEmployeeModal = ({ onClose, onAdd }) => {
  const [form, setForm] = useState({
    image: "",
    id: "",
    name: "",
    phone: "",
    email: "",
    department: "",
    shiftStart: "",
    shiftEnd: "",
    password: "",
    salary: "",
  });

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = () => {
    onAdd({
      ...form,
      image:
        form.image ||
        "https://i.pravatar.cc/150?img=68",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">

        {/* HEADER */}
        <div className="bg-primary p-4 text-white font-bold text-lg flex items-center gap-2">
          <FaUsers />
          Add New Employee
        </div>

        {/* FORM */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            name="image"
            placeholder="Profile Image URL"
            className="border rounded-lg p-2 focus:ring-2 focus:ring-primary col-span-1 sm:col-span-2"
            onChange={handleChange}
          />
          <input
            name="id"
            placeholder="Employee ID"
            className="border rounded-lg p-2 focus:ring-2 focus:ring-primary"
            onChange={handleChange}
          />
          <input
            name="name"
            placeholder="Full Name"
            className="border rounded-lg p-2 focus:ring-2 focus:ring-primary"
            onChange={handleChange}
          />
          <input
            name="phone"
            placeholder="Phone Number"
            className="border rounded-lg p-2 focus:ring-2 focus:ring-primary"
            onChange={handleChange}
          />
          <input
            name="email"
            placeholder="Email"
            className="border rounded-lg p-2 focus:ring-2 focus:ring-primary"
            onChange={handleChange}
          />

          <select
            name="department"
            className="border rounded-lg p-2 focus:ring-2 focus:ring-primary"
            onChange={handleChange}
          >
            <option value="">Select Department</option>
            <option>Manager</option>
            <option>Billing</option>
            <option>Delivery</option>
            <option>Dispatch</option>
            <option>Marketing</option>
            <option>Sales</option>
          </select>

          <input
            type="time"
            name="shiftStart"
            className="border rounded-lg p-2 focus:ring-2 focus:ring-primary"
            onChange={handleChange}
          />
          <input
            type="time"
            name="shiftEnd"
            className="border rounded-lg p-2 focus:ring-2 focus:ring-primary"
            onChange={handleChange}
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            className="border rounded-lg p-2 focus:ring-2 focus:ring-primary col-span-1 sm:col-span-2"
            onChange={handleChange}
          />

           <input
            type="number"
            name="salary"
            placeholder="Salary"
            className="border rounded-lg p-2 focus:ring-2 focus:ring-primary col-span-1 sm:col-span-2"
            onChange={handleChange}
          />
        </div>

        {/* ACTIONS */}
        <div className="flex gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 border rounded-lg p-2 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 bg-primary text-white rounded-lg p-2 font-bold hover:bg-primary/90"
          >
            Add Employee
          </button>
        </div>
      </div>
    </div>
  );
};
