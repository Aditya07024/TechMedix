import React, { useEffect, useMemo, useState } from "react";
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
import { API_BASE_URL } from "../../utils/apiBase";

const initialFilters = {
  chemical_class: "",
  therapeutic_class: "",
  action_class: "",
  category: "",
  habit_forming: "",
};

function normalizeDetailList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item ?? "").trim())
          .filter(Boolean);
      }
    } catch {
      // Fall back to splitting on common delimiters.
    }

    return trimmed
      .split(/\r?\n|,|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

const Search = () => {
  const location = useLocation();
  const navigate = useNavigate();
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

      if (!trimmedMedicine && !trimmedSalt) {
        return;
      }

      setPagination((current) => ({ ...current, page: 1 }));

      if (trimmedMedicine) {
        setSearchTerm(trimmedMedicine);
      }

      if (trimmedSalt) {
        setSaltSearchTerm(trimmedSalt);
      }

      if (compareBySalt && trimmedMedicine) {
        try {
          const response = await getMedicines({
            page: 1,
            limit: 20,
            search: trimmedMedicine,
          });

          if (!isMounted) {
            return;
          }

          const matchedMedicine = response?.data?.[0] ?? null;
          const matchedSalt = matchedMedicine?.salt?.trim() ?? trimmedSalt;

          if (matchedSalt) {
            setSaltSearchTerm(matchedSalt);
            setAppliedSaltQuery(matchedSalt);
            setAppliedQuery("");
            return;
          }
        } catch (fetchError) {
          console.error("Failed to resolve medicine salt for comparison:", fetchError);
        }
      }

      setSelectedMedicineId(selectedMedicineIdFromRoute);
      setAppliedQuery(trimmedMedicine);
      setAppliedSaltQuery(trimmedSalt);
    }

    hydrateRouteSearch();

    return () => {
      isMounted = false;
    };
  }, [location.state]);

  useEffect(() => {
    let isMounted = true;

    async function loadFilterOptions() {
      try {
        setFiltersLoading(true);
        const response = await getMedicineFilters();

        if (!isMounted) {
          return;
        }

        setFilterOptions(
          response?.data ?? {
            chemical_class: [],
            therapeutic_class: [],
            action_class: [],
            category: [],
          },
        );
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }

        console.error("Failed to load medicine filters:", fetchError);
      } finally {
        if (isMounted) {
          setFiltersLoading(false);
        }
      }
    }

    loadFilterOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

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
            Object.entries(filters).filter(([, value]) => value !== ""),
          ),
        });

        if (!isMounted) {
          return;
        }

        const list = response?.data ?? [];
        const nextPagination = response?.pagination ?? pagination;

        console.log("Medicine list response:", {
          query: appliedQuery,
          saltQuery: appliedSaltQuery,
          filters,
          pagination: nextPagination,
          count: list.length,
          medicines: list,
        });

        if (
          list.length === 0 &&
          appliedQuery &&
          !appliedSaltQuery &&
          !Object.values(filters).some(Boolean)
        ) {
          try {
            const aiResponse = await lookupMedicineWithAi(appliedQuery);

            if (!isMounted) {
              return;
            }

            const aiMedicine = aiResponse?.data ?? null;

            if (aiMedicine) {
              setMedicines([aiMedicine]);
              setSelectedMedicine(aiMedicine);
              setSelectedMedicineId(aiMedicine.id);
              setPagination((current) => ({
                ...current,
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1,
              }));
              return;
            }
          } catch (aiError) {
            console.error("AI fallback medicine lookup failed:", aiError);
          }
        }

        setMedicines(list);
        setPagination((current) => ({
          ...current,
          ...nextPagination,
        }));

        setSelectedMedicineId((currentId) => {
          if (list.some((item) => item.id === currentId)) {
            return currentId;
          }

          return null;
        });
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }

        console.error("Failed to load medicines:", fetchError);
        setError("Failed to fetch medicines.");
        setMedicines([]);
        setSelectedMedicineId(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadMedicines();

    return () => {
      isMounted = false;
    };
  }, [appliedQuery, appliedSaltQuery, filters, pagination.page, pagination.limit]);

  useEffect(() => {
    if (!selectedMedicineId) {
      setSelectedMedicine(null);
      return;
    }

    if (typeof selectedMedicineId === "string" && selectedMedicineId.startsWith("ai:")) {
      setDetailsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadMedicineDetails() {
      try {
        setDetailsLoading(true);
        const response = await getMedicineById(selectedMedicineId);
        console.log("Selected medicine details response:", {
          selectedMedicineId,
          payload: response?.data ?? null,
          rawResponse: response,
        });

        if (!isMounted) {
          return;
        }

        setSelectedMedicine(response?.data ?? null);
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }

        console.error("Failed to load medicine details:", fetchError);
        setSelectedMedicine(null);
      } finally {
        if (isMounted) {
          setDetailsLoading(false);
        }
      }
    }

    loadMedicineDetails();

    return () => {
      isMounted = false;
    };
  }, [selectedMedicineId]);

  const summaryMeta = useMemo(() => {
    if (!selectedMedicine) {
      return [];
    }

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
          ? selectedMedicine.habit_forming
            ? "Yes"
            : "No"
          : "",
      ],
    ].filter(([, value]) => value);
  }, [selectedMedicine]);

  const detailUses = useMemo(
    () => normalizeDetailList(selectedMedicine?.uses ?? selectedMedicine?.usage),
    [selectedMedicine],
  );

  const detailSideEffects = useMemo(
    () =>
      normalizeDetailList(
        selectedMedicine?.side_effects ?? selectedMedicine?.sideeffects,
      ),
    [selectedMedicine],
  );

  const detailSalts = useMemo(
    () => normalizeDetailList(selectedMedicine?.salts ?? selectedMedicine?.salt),
    [selectedMedicine],
  );

  const detailComposition = useMemo(
    () =>
      normalizeDetailList([
        selectedMedicine?.short_composition1,
        selectedMedicine?.short_composition2,
      ]),
    [selectedMedicine],
  );

  const detailSubstitutes = useMemo(
    () => normalizeDetailList(selectedMedicine?.substitutes),
    [selectedMedicine],
  );

  const handleSearch = (event) => {
    event.preventDefault();
    setPagination((current) => ({ ...current, page: 1 }));
    setAppliedQuery(searchTerm.trim());
    setAppliedSaltQuery(saltSearchTerm.trim());
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setPagination((current) => ({ ...current, page: 1 }));
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
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
  };

  const handleSafetyCheck = async () => {
    try {
      setSafetyLoading(true);
      setSafetyError(null);
      setSafetyResult(null);

      const user = JSON.parse(localStorage.getItem("user"));
      if (!user?.id) {
        setSafetyError("User not logged in");
        return;
      }

      const candidate = (
        selectedMedicine?.salt ||
        selectedMedicine?.name ||
        appliedQuery ||
        ""
      ).trim();

      if (!candidate) {
        setSafetyError("Select a medicine first");
        return;
      }

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
    if (typeof warning === "string") {
      return warning;
    }

    const pair = [warning.medicine_1, warning.medicine_2].filter(Boolean);
    if (pair.length > 0) {
      return `${pair.join(" + ")}: ${warning.description || ""}`;
    }

    return warning.description || JSON.stringify(warning);
  };

  const fetchInsights = async () => {
    if (!selectedMedicine?.name) {
      return;
    }

    try {
      setPriceInsightsLoading(true);
      setPriceInsights(null);
      const response = await getPriceInsights(selectedMedicine.name);
      if (response?.success) {
        setPriceInsights(response.data);
      }
    } catch (fetchError) {
      console.error("Failed to fetch price insights:", fetchError);
      setPriceInsights(null);
    } finally {
      setPriceInsightsLoading(false);
    }
  };

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
              {/* <div className="search-input-group">
                <img src={assets.search_icon} alt="" className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by salt"
                  value={saltSearchTerm}
                  onChange={(event) => setSaltSearchTerm(event.target.value)}
                />
              </div> */}
              <button type="submit" className="search-submit" disabled={loading}>
                {loading ? "Searching..." : "Search"}
              </button>
              <button
                type="button"
                className="search-reset"
                onClick={handleReset}
              >
                Reset
              </button>
            </div>
          </form>

          <div className="filters-panel">
            <select
              name="chemical_class"
              value={filters.chemical_class}
              onChange={handleFilterChange}
              disabled={filtersLoading}
            >
              <option value="">All Chemical Classes</option>
              {filterOptions.chemical_class.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <select
              name="therapeutic_class"
              value={filters.therapeutic_class}
              onChange={handleFilterChange}
              disabled={filtersLoading}
            >
              <option value="">All Therapeutic Classes</option>
              {filterOptions.therapeutic_class.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <select
              name="action_class"
              value={filters.action_class}
              onChange={handleFilterChange}
              disabled={filtersLoading}
            >
              <option value="">All Action Classes</option>
              {filterOptions.action_class.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <select
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              disabled={filtersLoading}
            >
              <option value="">All Categories</option>
              {filterOptions.category.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <select
              name="habit_forming"
              value={filters.habit_forming}
              onChange={handleFilterChange}
            >
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
          <h3>
            Medicines {pagination.total ? `(${pagination.total})` : ""}
          </h3>
          <p>
            {appliedSaltQuery
              ? `Comparing by salt: ${appliedSaltQuery}`
              : `Page ${pagination.page} of ${Math.max(pagination.totalPages, 1)}`}
          </p>
        </div>

        <div className="results-grid">
          <div className="grid-left">
            {loading ? (
              <div className="no-results">
                <p>Loading medicines...</p>
              </div>
            ) : medicines.length > 0 ? (
              medicines.map((item) => (
                <div
                  key={item.id}
                  className={`medicine-item ${
                    selectedMedicineId === item.id ? "selected" : ""
                  }`}
                  onClick={() => {
                    setSelectedMedicineId(item.id);
                    if (item.salt) {
                      setSaltSearchTerm(item.salt);
                    }
                  }}
                >
                  <div className="medicine-content">
                    <img
                      src={item.image || assets.image1}
                      alt={item.name}
                    />
                    <div className="medicine-info">
                      <h4
                        className={
                          item.name && item.name.length > 45
                            ? "medicine-name compact"
                            : "medicine-name"
                        }
                      >
                        {item.name}
                      </h4>
                      <div className="medicine-tags">
                        {item.is_ai_generated ? (
                          <span className="tag">AI Suggested</span>
                        ) : null}
                        {item.category ? (
                          <span className="tag">{item.category}</span>
                        ) : null}
                        {item.type ? (
                          <span className="tag">{item.type}</span>
                        ) : null}
                        {item.pack_size_label ? (
                          <span className="tag">{item.pack_size_label}</span>
                        ) : null}
                        {item.therapeutic_class ? (
                          <span className="tag">
                            THERAPEUTIC CLASS: {item.therapeutic_class}
                          </span>
                        ) : null}
                        {item.manufacturer_name ? (
                          <span className="tag">{item.manufacturer_name}</span>
                        ) : null}
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
                  setPagination((current) => ({
                    ...current,
                    page: Math.max(1, current.page - 1),
                  }))
                }
                disabled={pagination.page <= 1 || loading}
              >
                Previous
              </button>
              <span>
                {pagination.page} / {Math.max(pagination.totalPages, 1)}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPagination((current) => ({
                    ...current,
                    page: Math.min(
                      Math.max(current.totalPages, 1),
                      current.page + 1,
                    ),
                  }))
                }
                disabled={
                  loading ||
                  pagination.totalPages === 0 ||
                  pagination.page >= pagination.totalPages
                }
              >
                Next
              </button>
            </div>
          </div>

          <div className="grid-right">
            {detailsLoading ? (
              <div className="no-product-selected">
                <p>Loading medicine details...</p>
              </div>
            ) : selectedMedicine ? (
              <div className="detail-card">
                <div className="detail-hero">
                  <img
                    src={selectedMedicine.image || assets.image1}
                    alt={selectedMedicine.name}
                  />
                  <div>
                    <h1
                      className={
                        selectedMedicine.name &&
                        selectedMedicine.name.length > 55
                          ? "detail-title compact"
                          : "detail-title"
                      }
                    >
                      {selectedMedicine.name}
                    </h1>
                    <p className="detail-price">
                      {selectedMedicine.price != null
                        ? `₹${selectedMedicine.price}`
                        : "Price unavailable"}
                    </p>
                    {selectedMedicine.link ? (
                      <a
                        href={selectedMedicine.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="buy-button"
                      >
                        Buy Now
                      </a>
                    ) : null}
                  </div>
                </div>

                {summaryMeta.length > 0 ? (
                  <div className="detail-meta">
                    {summaryMeta.map(([label, value]) => (
                      <div className="detail-meta-item" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}

                {selectedMedicine.is_ai_generated ? (
                  <div className="info-section">
                    <h4>AI Fallback</h4>
                    <p>
                      {selectedMedicine.ai_disclaimer ||
                        "This medicine was generated by AI because it was not found in the dataset. Verify it before use."}
                    </p>
                  </div>
                ) : null}

                <div className="safety-check-section">
                  <button
                    type="button"
                    className="safety-check-btn"
                    onClick={handleSafetyCheck}
                    disabled={safetyLoading}
                  >
                    {safetyLoading ? "Running Safety Check..." : "Run Safety Check"}
                  </button>

                  {safetyError && <p className="safety-error">{safetyError}</p>}

                  {safetyResult?.warnings?.length > 0 ? (
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
                  ) : null}

                  {safetyResult &&
                  (!safetyResult.warnings ||
                    safetyResult.warnings.length === 0) ? (
                    <p className="safety-safe">No safety issues detected.</p>
                  ) : null}
                </div>

                <div className="price-insights-section">
                  <button
                    type="button"
                    className="price-insights-btn"
                    onClick={fetchInsights}
                    disabled={priceInsightsLoading}
                  >
                    {priceInsightsLoading ? "Loading..." : "View Price Insights"}
                  </button>

                  {priceInsights ? (
                    <div className="price-insights-card">
                      <div className="price-insight-row">
                        <span className="insight-label">Trend</span>
                        <span className={`insight-value trend-${priceInsights.trend}`}>
                          {priceInsights.trend}
                        </span>
                      </div>
                      <div className="price-insight-row">
                        <span className="insight-label">Recommendation</span>
                        <span
                          className={`insight-value rec-${priceInsights.recommendation}`}
                        >
                          {priceInsights.recommendation}
                        </span>
                      </div>
                      {priceInsights.avgPrice != null ? (
                        <div className="price-insight-row">
                          <span className="insight-label">Average Price</span>
                          <span className="insight-value">
                            ₹{priceInsights.avgPrice}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="detail-sections">
                  {selectedMedicine.medicine_desc ? (
                    <div className="info-section">
                      <h4>Description</h4>
                      <p>{selectedMedicine.medicine_desc}</p>
                    </div>
                  ) : null}
                  {selectedMedicine.info ? (
                    <div className="info-section">
                      <h4>Information</h4>
                      <p>{selectedMedicine.info}</p>
                    </div>
                  ) : null}
                  {selectedMedicine.benefits ? (
                    <div className="info-section">
                      <h4>Benefits</h4>
                      <p>{selectedMedicine.benefits}</p>
                    </div>
                  ) : null}
                  {selectedMedicine.usage ? (
                    <div className="info-section">
                      <h4>Usage</h4>
                      <p>{selectedMedicine.usage}</p>
                    </div>
                  ) : null}
                  {selectedMedicine.working ? (
                    <div className="info-section">
                      <h4>How It Works</h4>
                      <p>{selectedMedicine.working}</p>
                    </div>
                  ) : null}
                  {selectedMedicine.safetyadvice ? (
                    <div className="info-section">
                      <h4>Safety Advice</h4>
                      <p>{selectedMedicine.safetyadvice}</p>
                    </div>
                  ) : null}
                  {selectedMedicine.drug_interactions ? (
                    <div className="info-section">
                      <h4>Drug Interactions</h4>
                      <p>{selectedMedicine.drug_interactions}</p>
                    </div>
                  ) : null}
                </div>

                <div className="detail-pill-sections">
                  {detailComposition.length ? (
                    <div className="pill-section">
                      <h4>Composition</h4>
                      <div className="pill-list">
                        {detailComposition.map((item) => (
                          <span key={`composition-${item}`} className="detail-pill">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {detailSalts.length ? (
                    <div className="pill-section">
                      <h4>Salts</h4>
                      <div className="pill-list">
                        {detailSalts.map((item) => (
                          <span key={`salt-${item}`} className="detail-pill">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {detailUses.length ? (
                    <div className="pill-section">
                      <h4>Uses</h4>
                      <div className="pill-list">
                        {detailUses.map((item) => (
                          <span key={`use-${item}`} className="detail-pill">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {detailSideEffects.length ? (
                    <div className="pill-section">
                      <h4>Side Effects</h4>
                      <div className="pill-list">
                        {detailSideEffects.map((item) => (
                          <span key={`effect-${item}`} className="detail-pill warning">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {selectedMedicine.substitute_details?.length ? (
                    <div className="pill-section">
                      <h4>Substitutes</h4>
                      <div className="substitute-link-list">
                        {selectedMedicine.substitute_details.map((item) => (
                          <button
                            key={`substitute-${item.id}`}
                            type="button"
                            className="detail-pill substitute-link"
                            onClick={() =>
                              navigate(`/medicines/${item.id}`, {
                                state: { product: item },
                              })
                            }
                          >
                            {item.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : detailSubstitutes.length ? (
                    <div className="pill-section">
                      <h4>Substitutes</h4>
                      <div className="substitute-link-list">
                        {detailSubstitutes.map((item) => (
                          <button
                            key={`substitute-${item}`}
                            type="button"
                            className="detail-pill substitute-link"
                            onClick={() =>
                              navigate("/search", {
                                state: { medicine: item },
                              })
                            }
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
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
