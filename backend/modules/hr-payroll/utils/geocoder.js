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
      const parts = [
        addr.road || addr.pedestrian,
        addr.neighbourhood || addr.quarter,
        addr.suburb || addr.city_district,
        addr.city || addr.town || addr.village,
        addr.state_district || addr.state
      ].filter(Boolean);
      
      // Deduplicate parts
      const uniqueParts = [...new Set(parts)];
      
      const summary = uniqueParts.length > 0 ? uniqueParts.join(", ") : response.data.display_name.split(",").slice(0, 5).join(", ");
      if (summary) return summary;
    }
    
    // Fallback to BigDataCloud if Nominatim fails or returns empty
    console.log("🔄 Primary Geocoder failed, trying fallback...");
    const fallbackRes = await axios.get(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { timeout: 3000 }
    );
    
    if (fallbackRes.data && fallbackRes.data.city) {
      return `${fallbackRes.data.locality || fallbackRes.data.principalSubdivision}, ${fallbackRes.data.city}`;
    }

    return "Location Captured";
  } catch (error) {
    console.error("Reverse Geocoding Error:", error.message);
    // Final attempt at a different fallback if possible
    try {
      const fallbackRes = await axios.get(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
        { timeout: 3000 }
      );
      if (fallbackRes.data) {
        return `${fallbackRes.data.locality || ""}, ${fallbackRes.data.city || ""}`.trim().replace(/^,/, "") || "Location Captured";
      }
    } catch (e) {}
    return "Location Captured";
  }
};
