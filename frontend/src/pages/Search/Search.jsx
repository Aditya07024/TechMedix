import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import "./Search.css";
import { assets } from "../../assets/assets";
import Button from "@mui/material/Button";
import { useLocation, useNavigate } from "react-router-dom";
import Aipop from "../../components/AiPop/Aipop";
import {
  getMedicineById,
  getMedicineFilters,
  getMedicines,
  getPriceInsights,
  lookupMedicineWithAi,
} from "../../api/medicineApi";
import { addToWishlist, removeFromWishlist, getWishlist } from "../../api/wishlistApi";
import { API_BASE_URL } from "../../utils/apiBase";
import { useAuth } from "../../context/AuthContext";

const initialFilters = {
  chemical_class: "",
  therapeutic_class: "",
  action_class: "",
  category: "",
  habit_forming: "",
};

function normalizeDetailList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
      }
    } catch {}
    return trimmed.split(/\r?\n|,|;/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeTextSection(value) {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item ?? "").trim()).filter(Boolean);
    return items.length ? items.join(", ") : "";
  }
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

// ── Batch fetch with concurrency limit ──────────────────────────────────────
async function batchFetch(ids, fetchFn, concurrency = 5) {
  const results = [];
  for (let i = 0; i < ids.length; i += concurrency) {
    const chunk = ids.slice(i, i + concurrency);
    const settled = await Promise.allSettled(chunk.map(fetchFn));
    results.push(...settled);
  }
  return results;
}

const Search = ({ setShowLogin }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [askAi, setAskAi] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [saltSearchTerm, setSaltSearchTerm] = useState("");
  const [appliedSaltQuery, setAppliedSaltQuery] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [filterOptions, setFilterOptions] = useState({
    chemical_class: [],
    therapeutic_class: [],
    action_class: [],
    category: [],
  });
  const [medicines, setMedicines] = useState([]);
  const [selectedMedicineId, setSelectedMedicineId] = useState(null);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const detailCacheRef = useRef(new Map());
  const detailsRef = useRef(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [error, setError] = useState("");
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetyResult, setSafetyResult] = useState(null);
  const [safetyError, setSafetyError] = useState(null);
  const [priceInsights, setPriceInsights] = useState(null);
  const [priceInsightsLoading, setPriceInsightsLoading] = useState(false);

  // ── Wishlist state ──────────────────────────────────────────────────────────
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistMsg, setWishlistMsg] = useState(null); // {type: 'success'|'error', text}

  // ── Substitution state ──────────────────────────────────────────────────────
  const [substitutionMode, setSubstitutionMode] = useState(false);
  const [substitutionSourceId, setSubstitutionSourceId] = useState(null);
  const [substitutionLoading, setSubstitutionLoading] = useState(false);
  const substituteCacheRef = useRef(new Map()); // key: medicineId → array of medicine objects

  // ── Load wishlist IDs on login ──────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      setWishlistIds(new Set());
      return;
    }
    async function loadWishlistIds() {
      try {
        const data = await getWishlist();
        const ids = new Set((data?.data ?? []).map((item) => String(item.medicine_id)));
        setWishlistIds(ids);
      } catch {
        /* silent */
      }
    }
    loadWishlistIds();
  }, [isAuthenticated]);

  // ── Route hydration ─────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    async function hydrateRouteSearch() {
      const medicineFromRoute = location.state?.medicine;
      const saltFromRoute = location.state?.salt;
      const compareBySalt = Boolean(location.state?.compareBySalt);
      const selectedMedicineIdFromRoute = location.state?.selectedMedicineId ?? null;

      const trimmedMedicine =
        typeof medicineFromRoute === "string" ? medicineFromRoute.trim() : "";
      const trimmedSalt =
        typeof saltFromRoute === "string" ? saltFromRoute.trim() : "";

      if (!trimmedMedicine && !trimmedSalt) return;

      setPagination((current) => ({ ...current, page: 1 }));
      if (trimmedMedicine) setSearchTerm(trimmedMedicine);
      if (trimmedSalt) setSaltSearchTerm(trimmedSalt);

      if (compareBySalt && trimmedMedicine) {
        try {
          const response = await getMedicines({ page: 1, limit: 20, search: trimmedMedicine });
          if (!isMounted) return;
          const matchedMedicine = response?.data?.[0] ?? null;
          const matchedSalt = matchedMedicine?.salt?.trim() ?? trimmedSalt;
          if (matchedSalt) {
            setSaltSearchTerm(matchedSalt);
            setAppliedSaltQuery(matchedSalt);
            setAppliedQuery("");
            return;
          }
        } catch (fetchError) {
          console.error("Failed to resolve medicine salt:", fetchError);
        }
      }

      setSelectedMedicineId(selectedMedicineIdFromRoute);
      setAppliedQuery(trimmedMedicine);
      setAppliedSaltQuery(trimmedSalt);
    }
    hydrateRouteSearch();
    return () => { isMounted = false; };
  }, [location.state]);

  // ── Load filter options ─────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    async function loadFilterOptions() {
      try {
        setFiltersLoading(true);
        const response = await getMedicineFilters();
        if (!isMounted) return;
        setFilterOptions(
          response?.data ?? { chemical_class: [], therapeutic_class: [], action_class: [], category: [] }
        );
      } catch (fetchError) {
        if (!isMounted) return;
        console.error("Failed to load medicine filters:", fetchError);
      } finally {
        if (isMounted) setFiltersLoading(false);
      }
    }
    loadFilterOptions();
    return () => { isMounted = false; };
  }, []);

  // ── Load medicine list + pre-cache all 20 ──────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    setSubstitutionMode(false); // clear substitution mode on new search
    setSubstitutionSourceId(null);

    async function loadMedicines() {
      try {
        setLoading(true);
        setError("");

        const response = await getMedicines({
          page: pagination.page,
          limit: pagination.limit,
          search: appliedQuery || undefined,
          salt_search: appliedSaltQuery || undefined,
          ...Object.fromEntries(
            Object.entries(filters).filter(([, value]) => value !== "")
          ),
        });

        if (!isMounted) return;

        const list = response?.data ?? [];
        const nextPagination = response?.pagination ?? pagination;

        // AI fallback if no results
        if (
          list.length === 0 &&
          appliedQuery &&
          !appliedSaltQuery &&
          !Object.values(filters).some(Boolean)
        ) {
          try {
            const aiResponse = await lookupMedicineWithAi(appliedQuery);
            if (!isMounted) return;
            const aiMedicine = aiResponse?.data ?? null;
            if (aiMedicine) {
              setMedicines([aiMedicine]);
              setSelectedMedicine(aiMedicine);
              setSelectedMedicineId(aiMedicine.id);
              setPagination((current) => ({ ...current, page: 1, limit: 20, total: 1, totalPages: 1 }));
              return;
            }
          } catch (aiError) {
            console.error("AI fallback failed:", aiError);
          }
        }

        setMedicines(list);
        setPagination((current) => ({ ...current, ...nextPagination }));
        setSelectedMedicineId((currentId) => {
          if (list.some((item) => String(item.id) === String(currentId))) return currentId;
          return null;
        });

        // ── Pre-cache all 20 medicines in background after UI render ──────
        if (list.length > 0) {
          setTimeout(() => {
            if (!isMounted) return;
            const uncachedIds = list
              .filter((item) => item.id && !detailCacheRef.current.has(String(item.id)))
              .map((item) => item.id);

            if (uncachedIds.length > 0) {
              batchFetch(uncachedIds, getMedicineById, 5).then((settled) => {
                if (!isMounted) return;
                settled.forEach((result, idx) => {
                  if (result.status === "fulfilled") {
                    const med = result.value?.data ?? null;
                    if (med?.id) detailCacheRef.current.set(String(med.id), med);
                    else if (uncachedIds[idx]) {
                      const fallback = result.value?.data ?? null;
                      if (fallback) detailCacheRef.current.set(String(uncachedIds[idx]), fallback);
                    }
                  }
                });
              });
            }
          }, 100);
        }
      } catch (fetchError) {
        if (!isMounted) return;
        console.error("Failed to load medicines:", fetchError);
        setError("Failed to fetch medicines.");
        setMedicines([]);
        setSelectedMedicineId(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadMedicines();
    return () => { isMounted = false; };
  }, [appliedQuery, appliedSaltQuery, filters, pagination.page, pagination.limit]);

  // ── Load selected medicine detail (from cache first) ───────────────────────
  useEffect(() => {
    if (!selectedMedicineId) { setSelectedMedicine(null); return; }
    if (typeof selectedMedicineId === "string" && selectedMedicineId.startsWith("ai:")) {
      setDetailsLoading(false);
      return;
    }

    let isMounted = true;
    async function loadMedicineDetails() {
      const listMatch = medicines.find((item) => String(item.id) === String(selectedMedicineId)) ?? null;
      const cachedMedicine = detailCacheRef.current.get(String(selectedMedicineId)) ?? null;
      const immediateMedicine = cachedMedicine ?? listMatch;

      if (immediateMedicine) {
        setSelectedMedicine((current) =>
          current?.id === immediateMedicine.id && current === immediateMedicine
            ? current : immediateMedicine
        );
      }

      if (cachedMedicine) { setDetailsLoading(false); return; }

      try {
        setDetailsLoading(true);
        const response = await getMedicineById(selectedMedicineId);
        if (!isMounted) return;
        const nextMedicine = response?.data ?? null;
        if (nextMedicine) detailCacheRef.current.set(String(selectedMedicineId), nextMedicine);
        setSelectedMedicine(nextMedicine ?? immediateMedicine);
      } catch (fetchError) {
        if (!isMounted) return;
        console.error("Failed to load medicine details:", fetchError);
        setSelectedMedicine(immediateMedicine);
      } finally {
        if (isMounted) setDetailsLoading(false);
      }
    }

    loadMedicineDetails();
    return () => { isMounted = false; };
  }, [selectedMedicineId, medicines]);

  // ── Computed detail data ────────────────────────────────────────────────────
  const summaryMeta = useMemo(() => {
    if (!selectedMedicine) return [];
    return [
      ["Salt", selectedMedicine.salt],
      ["Primary Composition", selectedMedicine.short_composition1],
      ["Secondary Composition", selectedMedicine.short_composition2],
      ["Salt Composition", selectedMedicine.salt_composition],
      ["Manufacturer", selectedMedicine.manufacturer_name],
      ["Type", selectedMedicine.type],
      ["Pack Size", selectedMedicine.pack_size_label],
      ["Category", selectedMedicine.category],
      ["Chemical Class", selectedMedicine.chemical_class],
      ["Therapeutic Class", selectedMedicine.therapeutic_class],
      ["Action Class", selectedMedicine.action_class],
      [
        "Habit Forming",
        typeof selectedMedicine.habit_forming === "boolean"
          ? selectedMedicine.habit_forming ? "Yes" : "No"
          : "",
      ],
    ].filter(([, value]) => value);
  }, [selectedMedicine]);

  const detailUses = useMemo(
    () => normalizeDetailList(selectedMedicine?.uses ?? selectedMedicine?.usage),
    [selectedMedicine]
  );
  const detailSideEffects = useMemo(
    () => normalizeDetailList(selectedMedicine?.side_effects ?? selectedMedicine?.sideeffects),
    [selectedMedicine]
  );
  const detailSideEffectsText = useMemo(
    () => normalizeTextSection(selectedMedicine?.side_effects_text ?? selectedMedicine?.side_effects ?? selectedMedicine?.sideeffects),
    [selectedMedicine]
  );
  const detailSalts = useMemo(
    () => normalizeDetailList(selectedMedicine?.salts ?? selectedMedicine?.salt),
    [selectedMedicine]
  );
  const detailComposition = useMemo(
    () => normalizeDetailList([selectedMedicine?.short_composition1, selectedMedicine?.short_composition2]),
    [selectedMedicine]
  );
  const detailSubstitutes = useMemo(
    () => normalizeDetailList(selectedMedicine?.substitutes),
    [selectedMedicine]
  );

  // ── Wishlist helpers ────────────────────────────────────────────────────────
  const showWishlistMsg = (type, text) => {
    setWishlistMsg({ type, text });
    setTimeout(() => setWishlistMsg(null), 2500);
  };

  const medicineWishlistId = selectedMedicine
    ? String(selectedMedicine.id ?? selectedMedicine._id ?? selectedMedicine.name ?? "")
    : null;
  const isInWishlist = medicineWishlistId ? wishlistIds.has(medicineWishlistId) : false;

  const handleWishlistToggle = async () => {
    if (!isAuthenticated) {
      if (setShowLogin) setShowLogin(true);
      return;
    }
    if (!selectedMedicine) return;
    try {
      setWishlistLoading(true);
      if (isInWishlist) {
        await removeFromWishlist(medicineWishlistId);
        setWishlistIds((prev) => {
          const next = new Set(prev);
          next.delete(medicineWishlistId);
          return next;
        });
        showWishlistMsg("success", "Removed from wishlist");
      } else {
        await addToWishlist(selectedMedicine);
        setWishlistIds((prev) => new Set([...prev, medicineWishlistId]));
        showWishlistMsg("success", "Added to wishlist ❤️");
      }
    } catch {
      showWishlistMsg("error", "Failed to update wishlist");
    } finally {
      setWishlistLoading(false);
    }
  };

  // ── Safety check ────────────────────────────────────────────────────────────
  const handleSafetyCheck = async () => {
    try {
      setSafetyLoading(true);
      setSafetyError(null);
      setSafetyResult(null);

      const user = JSON.parse(localStorage.getItem("user"));
      if (!user?.id) { setSafetyError("User not logged in"); return; }

      const candidate = (
        selectedMedicine?.salt || selectedMedicine?.name || appliedQuery || ""
      ).trim();
      if (!candidate) { setSafetyError("Select a medicine first"); return; }

      const response = await fetch(`${API_BASE_URL}/api/prescriptions/safety-check-latest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        credentials: "include",
        body: JSON.stringify({ candidate_medicine: candidate }),
      });

      const data = await response.json();
      if (data?.success) {
        setSafetyResult(data.data);
      } else {
        setSafetyError(data?.error || "Safety check failed");
      }
    } catch (fetchError) {
      console.error("Safety check failed:", fetchError);
      setSafetyError("Failed to run safety check");
    } finally {
      setSafetyLoading(false);
    }
  };

  const formatWarning = (warning) => {
    if (typeof warning === "string") return warning;
    const pair = [warning.medicine_1, warning.medicine_2].filter(Boolean);
    if (pair.length > 0) return `${pair.join(" + ")}: ${warning.description || ""}`;
    return warning.description || JSON.stringify(warning);
  };

  // ── Find Substitutions ──────────────────────────────────────────────────────
  const cachedSubstitutes = selectedMedicine
    ? substituteCacheRef.current.get(String(selectedMedicine.id ?? "")) ?? null
    : null;

  const handleFindSubstitutions = useCallback(async () => {
    if (!selectedMedicine) return;
    const medId = String(selectedMedicine.id ?? "");

    // Use cache if already fetched for this medicine
    if (substituteCacheRef.current.has(medId)) {
      setSubstitutionSourceId(medId);
      setSubstitutionMode(true);
      return;
    }

    setSubstitutionLoading(true);
    try {
      // Get substitute names from the already-loaded detail
      const substituteNames = [
        ...(selectedMedicine.substitute_details?.map((s) => s.name) ?? []),
        ...detailSubstitutes,
      ].filter(Boolean);

      // Fetch full details for each substitute medicine in parallel
      const fetched = [];
      if (substituteNames.length > 0) {
        const results = await Promise.allSettled(
          substituteNames.map((name) =>
            getMedicines({ search: name, page: 1, limit: 1 }).then(
              (res) => res?.data?.[0] ?? null
            )
          )
        );
        results.forEach((r) => {
          if (r.status === "fulfilled" && r.value) {
            fetched.push(r.value);
            // Also cache the full detail
            if (r.value.id && !detailCacheRef.current.has(String(r.value.id))) {
              getMedicineById(r.value.id)
                .then((res) => {
                  const med = res?.data;
                  if (med?.id) detailCacheRef.current.set(String(med.id), med);
                })
                .catch(() => {});
            }
          }
        });
      }

      // Also include any substitute_details already on the medicine
      if (selectedMedicine.substitute_details?.length > 0) {
        for (const sub of selectedMedicine.substitute_details) {
          if (!fetched.some((f) => String(f.id) === String(sub.id))) fetched.push(sub);
        }
      }

      substituteCacheRef.current.set(medId, fetched);
      setSubstitutionSourceId(medId);
      setSubstitutionMode(true);
    } catch (err) {
      console.error("Find substitutions failed:", err);
    } finally {
      setSubstitutionLoading(false);
    }
  }, [selectedMedicine, detailSubstitutes]);

  // ── Search handlers ─────────────────────────────────────────────────────────
  const handleSearch = (event) => {
    event.preventDefault();
    setPagination((current) => ({ ...current, page: 1 }));
    setAppliedQuery(searchTerm.trim());
    setAppliedSaltQuery(saltSearchTerm.trim());
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setPagination((current) => ({ ...current, page: 1 }));
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const handleReset = () => {
    setSearchTerm("");
    setAppliedQuery("");
    setSaltSearchTerm("");
    setAppliedSaltQuery("");
    setFilters(initialFilters);
    setPagination((current) => ({ ...current, page: 1 }));
    setSafetyResult(null);
    setSafetyError(null);
    setPriceInsights(null);
    setSelectedMedicineId(null);
    setSelectedMedicine(null);
    setSubstitutionMode(false);
  };

  const fetchInsights = async () => {
    if (!selectedMedicine?.name) return;
    try {
      setPriceInsightsLoading(true);
      setPriceInsights(null);
      const response = await getPriceInsights(selectedMedicine.name);
      if (response?.success) setPriceInsights(response.data);
    } catch (fetchError) {
      console.error("Failed to fetch price insights:", fetchError);
    } finally {
      setPriceInsightsLoading(false);
    }
  };

  // ── The substitution list to render (from cache) ───────────────────────────
  const substituteList = substitutionMode && substitutionSourceId
    ? (substituteCacheRef.current.get(substitutionSourceId) ?? [])
    : [];

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="search-page">
      {askAi && <Aipop setShowAiPop={setAskAi} />}

      <div className="search-top">
        <div className="search-section">
          <h2>Browse Medicine Database</h2>
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-inputs-container">
              <div className="search-input-group">
                <img src={assets.search_icon} alt="" className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by medicine name"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <button type="submit" className="search-submit" disabled={loading}>
                {loading ? "Searching..." : "Search"}
              </button>
              <button type="button" className="search-reset" onClick={handleReset}>
                Reset
              </button>
            </div>
          </form>

          <div className="filters-panel">
            <select name="chemical_class" value={filters.chemical_class} onChange={handleFilterChange} disabled={filtersLoading}>
              <option value="">All Chemical Classes</option>
              {filterOptions.chemical_class.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <select name="therapeutic_class" value={filters.therapeutic_class} onChange={handleFilterChange} disabled={filtersLoading}>
              <option value="">All Therapeutic Classes</option>
              {filterOptions.therapeutic_class.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <select name="action_class" value={filters.action_class} onChange={handleFilterChange} disabled={filtersLoading}>
              <option value="">All Action Classes</option>
              {filterOptions.action_class.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <select name="category" value={filters.category} onChange={handleFilterChange} disabled={filtersLoading}>
              <option value="">All Categories</option>
              {filterOptions.category.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <select name="habit_forming" value={filters.habit_forming} onChange={handleFilterChange}>
              <option value="">Habit Forming: Any</option>
              <option value="true">Habit Forming: Yes</option>
              <option value="false">Habit Forming: No</option>
            </select>
          </div>
        </div>

        <div className="ai-div">
          <div className="heading-div">
            <h1>Ask AI Doctor About Your Medicine</h1>
            <Button variant="outlined" onClick={() => setAskAi(true)}>
              Open AI Doctor
            </Button>
          </div>
        </div>
      </div>

      <div className="search-results">
        {error && <div className="error-message">{error}</div>}

        <div className="results-header">
          <h3>Medicines {pagination.total ? `(${pagination.total})` : ""}</h3>
          <p>
            {appliedSaltQuery
              ? `Comparing by salt: ${appliedSaltQuery}`
              : `Page ${pagination.page} of ${Math.max(pagination.totalPages, 1)}`}
          </p>
        </div>

        <div className="results-grid">
          {/* ── LEFT PANEL: Medicine list ─────────────────────────────────── */}
          <div className="grid-left">
            {substitutionMode ? (
              <div className="substitution-results-wrapper">
                <div className="substitution-results-header">
                  <div className="subs-header-info">
                    <h3>Substitutes</h3>
                    <p className="subs-source-desc">
                      Alternatives for{" "}
                      <strong>
                        {detailCacheRef.current.get(String(substitutionSourceId))?.name ||
                          selectedMedicine?.name ||
                          "Selected Medicine"}
                      </strong>
                    </p>
                    <span className="subs-count-tag">
                      {substituteList.length} found
                    </span>
                  </div>
                  <button
                    type="button"
                    className="back-to-results-btn"
                    onClick={() => {
                      setSubstitutionMode(false);
                      setSubstitutionSourceId(null);
                    }}
                  >
                    ✕ Close Substitutes
                  </button>
                </div>

                {substituteList.length > 0 ? (
                  <div className="substitutes-list">
                    {substituteList.map((item, idx) => (
                      <div
                        key={item.id ?? `sub-${idx}`}
                        className={`medicine-item substitute-item ${
                          String(selectedMedicineId) === String(item.id) ? "selected" : ""
                        }`}
                        onClick={() => {
                          setSelectedMedicine(item);
                          setSelectedMedicineId(item.id);
                          if (item.salt) setSaltSearchTerm(item.salt);
                        }}
                      >
                        <div className="medicine-content">
                          <img src={item.image || assets.image1} alt={item.name} />
                          <div className="medicine-info">
                            <h4 className={item.name && item.name.length > 45 ? "medicine-name compact" : "medicine-name"}>
                              {item.name}
                            </h4>
                            <div className="medicine-tags">
                              {item.manufacturer_name && <span className="tag">{item.manufacturer_name}</span>}
                              {item.category && <span className="tag">{item.category}</span>}
                              {item.type && <span className="tag">{item.type}</span>}
                              {item.pack_size_label && <span className="tag">{item.pack_size_label}</span>}
                            </div>
                            <p className="price">
                              {item.price != null ? `₹${item.price}` : "Price unavailable"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-results">
                    <p>No alternative medicines found in the database.</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {loading ? (
                  <div className="no-results"><p>Loading medicines...</p></div>
                ) : medicines.length > 0 ? (
                  medicines.map((item) => (
                    <div
                      key={item.id}
                      className={`medicine-item ${String(selectedMedicineId) === String(item.id) ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedMedicine(item);
                        setSelectedMedicineId(item.id);
                        if (item.salt) setSaltSearchTerm(item.salt);
                        if (window.innerWidth <= 1100) {
                          detailsRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
                        }
                      }}
                    >
                      <div className="medicine-content">
                        <img src={item.image || assets.image1} alt={item.name} />
                        <div className="medicine-info">
                          <h4 className={item.name && item.name.length > 45 ? "medicine-name compact" : "medicine-name"}>
                            {item.name}
                          </h4>
                          <div className="medicine-tags">
                            {item.is_ai_generated && <span className="tag">AI Suggested</span>}
                            {item.category && <span className="tag">{item.category}</span>}
                            {item.type && <span className="tag">{item.type}</span>}
                            {item.pack_size_label && <span className="tag">{item.pack_size_label}</span>}
                            {item.therapeutic_class && (
                              <span className="tag">THERAPEUTIC CLASS: {item.therapeutic_class}</span>
                            )}
                            {item.manufacturer_name && <span className="tag">{item.manufacturer_name}</span>}
                          </div>
                          <p className="price">
                            {item.price != null ? `₹${item.price}` : "Price unavailable"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-results">
                    <img src={assets.search_icon} alt="" />
                    <p>No medicines found matching your current search.</p>
                  </div>
                )}

                <div className="pagination-bar">
                  <button
                    type="button"
                    onClick={() =>
                      setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))
                    }
                    disabled={pagination.page <= 1 || loading}
                  >
                    Previous
                  </button>
                  <span>{pagination.page} / {Math.max(pagination.totalPages, 1)}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPagination((current) => ({
                        ...current,
                        page: Math.min(Math.max(current.totalPages, 1), current.page + 1),
                      }))
                    }
                    disabled={loading || pagination.totalPages === 0 || pagination.page >= pagination.totalPages}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── RIGHT PANEL: Medicine detail ──────────────────────────────── */}
          <div className="grid-right" ref={detailsRef}>
            {detailsLoading ? (
              <div className="no-product-selected"><p>Loading medicine details...</p></div>
            ) : selectedMedicine ? (
              <div className="detail-card">
                {/* Hero section */}
                <div className="detail-hero">
                  <img src={selectedMedicine.image || assets.image1} alt={selectedMedicine.name} />
                  <div>
                    <h1 className={selectedMedicine.name && selectedMedicine.name.length > 55 ? "detail-title compact" : "detail-title"}>
                      {selectedMedicine.name}
                    </h1>
                    <p className="detail-price">
                      {selectedMedicine.price != null ? `₹${selectedMedicine.price}` : "Price unavailable"}
                    </p>

                    <div className="detail-hero-actions">
                      {selectedMedicine.link && (
                        <a href={selectedMedicine.link} target="_blank" rel="noopener noreferrer" className="buy-button">
                          Buy Now
                        </a>
                      )}

                      {/* ── Wishlist Button ─────────────────────────────── */}
                      <button
                        type="button"
                        className={`wishlist-toggle-btn ${isInWishlist ? "in-wishlist" : ""}`}
                        onClick={handleWishlistToggle}
                        disabled={wishlistLoading}
                        title={isAuthenticated ? (isInWishlist ? "Remove from Wishlist" : "Add to Wishlist") : "Login to save"}
                      >
                        <span className="wish-heart">{isInWishlist ? "❤️" : "🤍"}</span>
                        {wishlistLoading
                          ? "..."
                          : isAuthenticated
                          ? isInWishlist ? "Saved" : "Wishlist"
                          : "Login to Save"}
                      </button>
                    </div>

                    {/* Wishlist toast */}
                    {wishlistMsg && (
                      <div className={`wishlist-toast ${wishlistMsg.type}`}>
                        {wishlistMsg.text}
                      </div>
                    )}
                  </div>
                </div>

                {/* Meta */}
                {summaryMeta.length > 0 && (
                  <div className="detail-meta">
                    {summaryMeta.map(([label, value]) => (
                      <div className="detail-meta-item" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                )}

                {selectedMedicine.is_ai_generated && (
                  <div className="info-section">
                    <h4>AI Fallback</h4>
                    <p>{selectedMedicine.ai_disclaimer || "This medicine was generated by AI because it was not found in the dataset. Verify it before use."}</p>
                  </div>
                )}

                {/* ── Safety Check ─────────────────────────────────────────── */}
                <div className="safety-check-section">
                  <button
                    type="button"
                    className="safety-check-btn"
                    onClick={handleSafetyCheck}
                    disabled={safetyLoading}
                  >
                    {safetyLoading ? "Running Safety Check..." : "🛡 Run Safety Check"}
                  </button>

                  {safetyError && <p className="safety-error">{safetyError}</p>}

                  {safetyResult?.warnings?.length > 0 && (
                    <div className="safety-warnings">
                      <h4>Safety Warnings</h4>
                      <ul>
                        {safetyResult.warnings.map((warning, index) => (
                          <li key={`${selectedMedicine.id}-warning-${index}`}>
                            {formatWarning(warning)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {safetyResult && (!safetyResult.warnings || safetyResult.warnings.length === 0) && (
                    <p className="safety-safe">No safety issues detected.</p>
                  )}

                  {/* ── Find Substitutions Button ─────────────────────────── */}
                  <button
                    type="button"
                    className="find-substitution-btn"
                    onClick={handleFindSubstitutions}
                    disabled={substitutionLoading}
                  >
                    {substitutionLoading
                      ? "⏳ Finding Substitutes..."
                      : substitutionMode
                      ? "🔄 Refresh Substitutes"
                      : "🔍 Find Substitutions"}
                  </button>

                  {substitutionMode && (
                    <button
                      type="button"
                      className="clear-substitution-btn"
                      onClick={() => {
                        setSubstitutionMode(false);
                        setSubstitutionSourceId(null);
                      }}
                    >
                      ✕ Close Substitutes
                    </button>
                  )}
                </div>

                {/* Price insights */}
                <div className="price-insights-section">
                  {priceInsights && (
                    <div className="price-insights-card">
                      <div className="price-insight-row">
                        <span className="insight-label">Trend</span>
                        <span className={`insight-value trend-${priceInsights.trend}`}>{priceInsights.trend}</span>
                      </div>
                      <div className="price-insight-row">
                        <span className="insight-label">Recommendation</span>
                        <span className={`insight-value rec-${priceInsights.recommendation}`}>{priceInsights.recommendation}</span>
                      </div>
                      {priceInsights.avgPrice != null && (
                        <div className="price-insight-row">
                          <span className="insight-label">Average Price</span>
                          <span className="insight-value">₹{priceInsights.avgPrice}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Detail sections */}
                <div className="detail-sections">
                  {selectedMedicine.medicine_desc && (
                    <div className="info-section"><h4>Description</h4><p>{selectedMedicine.medicine_desc}</p></div>
                  )}
                  {selectedMedicine.info && (
                    <div className="info-section"><h4>Information</h4><p>{selectedMedicine.info}</p></div>
                  )}
                  {selectedMedicine.benefits && (
                    <div className="info-section"><h4>Benefits</h4><p>{selectedMedicine.benefits}</p></div>
                  )}
                  {selectedMedicine.usage && (
                    <div className="info-section"><h4>Usage</h4><p>{selectedMedicine.usage}</p></div>
                  )}
                  {selectedMedicine.working && (
                    <div className="info-section"><h4>How It Works</h4><p>{selectedMedicine.working}</p></div>
                  )}
                  {selectedMedicine.safetyadvice && (
                    <div className="info-section"><h4>Safety Advice</h4><p>{selectedMedicine.safetyadvice}</p></div>
                  )}
                  {selectedMedicine.drug_interactions && (
                    <div className="info-section"><h4>Drug Interactions</h4><p>{selectedMedicine.drug_interactions}</p></div>
                  )}
                </div>

                {/* Pill sections */}
                <div className="detail-pill-sections">
                  {detailComposition.length > 0 && (
                    <div className="pill-section">
                      <h4>Composition</h4>
                      <div className="pill-list">
                        {detailComposition.map((item) => (
                          <span key={`composition-${item}`} className="detail-pill">{item}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailSalts.length > 0 && (
                    <div className="pill-section">
                      <h4>Salts</h4>
                      <div className="pill-list">
                        {detailSalts.map((item) => (
                          <span key={`salt-${item}`} className="detail-pill">{item}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailUses.length > 0 && (
                    <div className="pill-section">
                      <h4>Uses</h4>
                      <div className="pill-list">
                        {detailUses.map((item) => (
                          <span key={`use-${item}`} className="detail-pill">{item}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailSideEffects.length > 0 && (
                    <div className="pill-section">
                      <h4>Side Effects</h4>
                      <div className="pill-list">
                        {detailSideEffects.map((item) => (
                          <span key={`effect-${item}`} className="detail-pill warning">{item}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Existing substitute links (kept for completeness, hidden when substitution panel is open) */}
                  {!substitutionMode && (
                    <>
                      {selectedMedicine.substitute_details?.length > 0 ? (
                        <div className="pill-section">
                          <h4>Substitutes</h4>
                          <div className="substitute-link-list">
                            {selectedMedicine.substitute_details.map((item) => (
                              <button
                                key={`substitute-${item.id}`}
                                type="button"
                                className="detail-pill substitute-link"
                                onClick={() => navigate(`/medicines/${item.id}`, { state: { product: item } })}
                              >
                                {item.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : detailSubstitutes.length > 0 ? (
                        <div className="pill-section">
                          <h4>Substitutes</h4>
                          <div className="substitute-link-list">
                            {detailSubstitutes.map((item) => (
                              <button
                                key={`substitute-${item}`}
                                type="button"
                                className="detail-pill substitute-link"
                                onClick={() => navigate("/search", { state: { medicine: item } })}
                              >
                                {item}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="no-product-selected">
                <img src={assets.search_icon} alt="" />
                <p>Select a medicine to view full details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Search;
