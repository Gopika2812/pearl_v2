import axios from "axios";
import Branch from "../../../models/Branch.js";

/**
 * Get Address name from Lat/Lng using Nominatim (OpenStreetMap)
 * @param {number} lat 
 * @param {number} lng 
 * @param {string} [branchId]
 * @returns {Promise<string>}
 */
export const getAddressFromCoords = async (lat, lng, branchId) => {
  try {
    let replacements = {};
    if (branchId) {
      try {
        const branch = await Branch.findById(branchId);
        if (branch && branch.locationReplacements) {
          replacements = branch.locationReplacements;
        }
      } catch (err) {
        console.warn("Failed to load branch geocoding replacements:", err.message);
      }
    }

    const cleanWithReplacements = (str) => {
      if (!str) return "";
      let result = str;
      for (const [target, replacement] of Object.entries(replacements)) {
        const regex = new RegExp(target, "gi");
        result = result.replace(regex, replacement);
      }
      // Default fallback for Padappakurichi to Palayamkottai if not overridden
      if (!replacements["Padappakurichi"]) {
        result = result.replace(/Padappakurichi/gi, "Palayamkottai");
      }
      return result;
    };

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
      const addr = response.data.address || {};
      
      const cleanRoad = (road) => {
        if (!road) return "";
        if (road.includes(" - ") && road.split(" - ").length > 2) {
          const segments = road.split(" - ");
          return segments[segments.length - 1]; // E.g., return just the last road descriptor
        }
        return road;
      };

      const poi = addr.building || addr.office || addr.amenity || addr.shop || addr.tourism || addr.leisure || addr.historic || addr.industrial || addr.commercial || addr.retail;
      const roadName = cleanRoad(addr.road || addr.pedestrian);

      const parts = [
        poi,
        addr.house_number,
        roadName,
        addr.neighbourhood || addr.quarter,
        addr.suburb || addr.city_district,
        addr.city || addr.town || addr.village,
        addr.county,
        addr.state_district || addr.state
      ].filter(Boolean);
      
      // Deduplicate parts
      const uniqueParts = [...new Set(parts.map(p => p.trim()))];
      
      let summary = uniqueParts.length > 0 ? uniqueParts.join(", ") : response.data.display_name.split(",").slice(0, 7).join(", ");
      if (summary) {
        summary = cleanWithReplacements(summary);
        const deduped = [...new Set(summary.split(",").map(s => s.trim()))].join(", ");
        return deduped;
      }
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
