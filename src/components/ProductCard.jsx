import { useState } from "react";
import { FaMinus, FaPlus, FaShoppingCart } from "react-icons/fa";

export default function ProductCard({ product, onAddToCart }) {
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = () => {
    onAddToCart({
      ...product,
      cartQuantity: quantity,
    });
    setQuantity(1);
  };

  // Get product group name (handle both object and string)
  const groupName = typeof product.productGroup === "object" 
    ? product.productGroup?.name 
    : product.productGroup;

  const stock = product.totalQty || 0;

  return (
    <div className="bg-white rounded-2xl shadow hover:shadow-2xl transition border overflow-hidden">
      {/* PRODUCT IMAGE */}
      <div className="relative w-full h-48 bg-gray-100 overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover hover:scale-105 transition"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
            <span className="text-sm">No Image</span>
          </div>
        )}
        {stock < 5 && stock > 0 && (
          <div className="absolute top-2 right-2 bg-yellow-400 text-white px-3 py-1 rounded-full text-xs font-semibold">
            Low Stock
          </div>
        )}
        {stock === 0 && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-bold">Out of Stock</span>
          </div>
        )}
      </div>

      {/* PRODUCT INFO */}
      <div className="p-4">
        <h3 className="font-bold text-gray-800 text-sm line-clamp-2">{product.name}</h3>
        
        {/* PRODUCT GROUP BADGE */}
        {groupName && (
          <div className="mt-2 inline-block bg-primary/10 text-primary px-2 py-1 rounded text-xs font-semibold">
            {groupName}
          </div>
        )}

        {/* PRICE & STOCK */}
        <div className="mt-3 flex justify-between items-center">
          <div>
            <p className="text-primary font-bold text-lg">₹{product.sellingPrice.toFixed(2)}</p>
            {product.mrp && product.mrp > product.sellingPrice && (
              <p className="text-gray-400 line-through text-sm">₹{product.mrp.toFixed(2)}</p>
            )}
          </div>
          <span className={`text-xs font-semibold ${stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stock > 0 ? `${stock} in stock` : 'Out of Stock'}
          </span>
        </div>

        {/* QUANTITY SELECTOR & BUY NOW */}
        {stock > 0 ? (
          <div className="mt-4 space-y-2">
            {/* QTY SELECTOR */}
            <div className="flex items-center justify-between border rounded-lg p-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="text-primary hover:bg-primary/10 p-2 rounded"
              >
                <FaMinus size={14} />
              </button>
              <span className="font-bold">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(stock, quantity + 1))}
                className="text-primary hover:bg-primary/10 p-2 rounded"
              >
                <FaPlus size={14} />
              </button>
            </div>

            {/* BUY NOW BUTTON */}
            <button
              onClick={handleAddToCart}
              className="w-full bg-primary text-white py-2 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition"
            >
              <FaShoppingCart size={16} />
              Buy Now
            </button>
          </div>
        ) : (
          <button disabled className="w-full bg-gray-300 text-gray-600 py-2 rounded-lg font-semibold mt-4 cursor-not-allowed">
            Out of Stock
          </button>
        )}
      </div>
    </div>
  );
}
