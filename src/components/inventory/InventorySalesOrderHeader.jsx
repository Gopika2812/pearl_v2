const InventorySalesOrderHeader = ({ title }) => {
  return (
    <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between border-b pb-4">
      <div>
        <h2 className="text-3xl font-bold text-primary font-cursive tracking-tight">
          {title}
        </h2>
        <p className="text-gray-500 text-sm mt-1 font-sans">
          Create and manage customer sales orders and invoices.
        </p>
      </div>
      <div className="mt-2 md:mt-0 px-4 py-1 bg-primary/10 rounded-full border border-primary/20">
        <span className="text-primary font-semibold text-sm italic font-sans">
          Sales Module
        </span>
      </div>
    </div>
  );
};

export default InventorySalesOrderHeader;