const InventorySalesOrderHeader = ({ title, description, children }) => {
  return (
    <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between border-b pb-4">
      <div>
        <h2 className="text-3xl font-bold text-primary font-cursive tracking-tight">
          {title}
        </h2>
        <p className="text-gray-500 text-sm mt-1 font-sans">
          {description || "Create and manage customer sales orders and invoices."}
        </p>
      </div>
      {children && <div className="mt-4 md:mt-0 flex items-center gap-3">{children}</div>}
    </div>
  );
};

export default InventorySalesOrderHeader;