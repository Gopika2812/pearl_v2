import { FaFileAlt } from "react-icons/fa";

export default function BranchDebitNote() {
  return (
    <div className="min-h-screen bg-gray-100 pt-20 md:pt-16 md:pl-64 px-4 md:px-6 pb-10">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-secondary to-primary text-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center gap-4">
            <FaFileAlt className="text-5xl opacity-80" />
            <h1 className="text-4xl font-bold">Debit Note 📄</h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <p className="text-gray-600">Debit Note module coming soon...</p>
        </div>
      </div>
    </div>
  );
}
