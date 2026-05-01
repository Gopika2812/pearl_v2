import axios from "axios";

/**
 * Get Address name from Lat/Lng using Nominatim (OpenStreetMap)
 * @param {number} lat 
 * @param {number} lng 
 * @returns {Promise<string>}
 */
export const getAddressFromCoords = async (lat, lng) => {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        timeout: 5000,
        headers: {
          "User-Agent": `ERP_Pearls_HR_${Math.random().toString(36).substring(7)}`
        }
      }
    );
    
    if (response.data && response.data.display_name) {
      const addr = response.data.address;
      // Build a nice short address
      const parts = [
        addr.road || addr.pedestrian || addr.suburb,
        addr.city || addr.town || addr.village
      ].filter(Boolean);
      
      return parts.length > 0 ? parts.join(", ") : response.data.display_name.split(",")[0];
    }
    return (lat && lng) ? `${lat.toFixed(2)}, ${lng.toFixed(2)}` : "Location Captured";
  } catch (error) {
    console.error("Reverse Geocoding Error:", error.message);
    return (lat && lng) ? `${lat.toFixed(2)}, ${lng.toFixed(2)}` : "Location Captured";
  }
};
