import { useEffect, useState } from "react";
import { FaFilter, FaShoppingCart, FaSignOutAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api";
import ProductCard from "../components/ProductCard";

export default function PearlsShopping() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customerData, setCustomerData] = useState(null);

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem("customerToken");
    const customer = localStorage.getItem("customerData");

    if (!token || !customer) {
      navigate("/customer-login");
      return;
    }

    setCustomerData(JSON.parse(customer));
    fetchProducts();
  }, [navigate]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/products`);
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        setProducts(result.data);

        // Extract unique product groups
        const groups = ["All"];
        result.data.forEach((p) => {
          const groupName = typeof p.productGroup === "object" 
            ? p.productGroup?.name 
            : p.productGroup;
          if (groupName && !groups.includes(groupName)) {
            groups.push(groupName);
          }
        });
        setProductGroups(groups);
      } else if (Array.isArray(result)) {
        // Fallback if API returns just array
        setProducts(result);
        const groups = ["All", ...new Set(result.map((p) => p.productGroup).filter(Boolean))];
        setProductGroups(groups);
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts =
    selectedGroup === "All"
      ? products
      : products.filter((p) => {
          const groupName = typeof p.productGroup === "object" 
            ? p.productGroup?.name 
            : p.productGroup;
          return groupName === selectedGroup;
        });

  const handleAddToCart = (product) => {
    setCart([...cart, product]);
    alert(`✅ Added "${product.name}" to cart!`);
  };

  const handleLogout = () => {
    localStorage.removeItem("customerToken");
    localStorage.removeItem("customerData");
    navigate("/customer-login");
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pl-64">
      {/* HEADER */}
      <div className="bg-white shadow sticky top-20 md:top-0 z-40">
        <div className="px-4 sm:px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-primary">Pearls Shopping</h1>
            {customerData && (
              <p className="text-sm text-gray-500">Welcome, {customerData.name}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button className="relative bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2">
              <FaShoppingCart />
              Cart ({cart.length})
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-100 text-red-600 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-200 transition"
            >
              <FaSignOutAlt size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="px-4 sm:px-6 py-6">
        {/* PRODUCT GROUP FILTER */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <FaFilter className="text-primary" />
            <h2 className="font-bold text-lg text-gray-800">Filter by Category</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {productGroups.map((group) => (
              <button
                key={group}
                onClick={() => setSelectedGroup(group)}
                className={`px-4 py-2 rounded-full font-semibold transition ${
                  selectedGroup === group
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {group}
              </button>
            ))}
          </div>
        </div>

        {/* PRODUCTS GRID */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No products available in this category</p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {selectedGroup} Products ({filteredProducts.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* CART SUMMARY (Bottom floating bar) */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 md:pl-80">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500">Items in cart</p>
              <p className="text-2xl font-bold text-primary">{cart.length}</p>
            </div>
            <button className="bg-primary text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2">
              <FaShoppingCart />
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
