import React, { useEffect, useState, useCallback } from "react";
import "./WishList.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getWishlist, removeFromWishlist } from "../../api/wishlistApi";

const WishList = ({ setShowLogin }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState("");

  const fetchWishlist = useCallback(async () => {
    try {
      setLoadingItems(true);
      setError("");
      const data = await getWishlist();
      setItems(data?.data ?? []);
    } catch {
      setError("Failed to load your wishlist. Please try again.");
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchWishlist();
    }
  }, [isAuthenticated, fetchWishlist]);

  const handleRemove = async (medicineId) => {
    try {
      setRemovingId(medicineId);
      await removeFromWishlist(medicineId);
      setItems((prev) => prev.filter((item) => item.medicine_id !== medicineId));
    } catch {
      setError("Failed to remove item. Please try again.");
    } finally {
      setRemovingId(null);
    }
  };

  // ── Auth guard ──────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="wishlist-page">
        <div className="wishlist-loading-screen">
          <div className="wishlist-spinner" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="wishlist-page">
        <div className="wishlist-login-gate">
          <div className="wishlist-gate-icon">❤️</div>
          <h1>Your Medicine Wishlist</h1>
          <p>Save medicines you want to track or purchase later. Login to access your personal wishlist.</p>
          <button
            className="wishlist-login-btn"
            onClick={() => setShowLogin && setShowLogin(true)}
          >
            Login to View Wishlist
          </button>
          <button
            className="wishlist-browse-btn"
            onClick={() => navigate("/search")}
          >
            Browse Medicines
          </button>
        </div>
      </div>
    );
  }

  // ── Authenticated view ──────────────────────────────────────────────────────
  return (
    <div className="wishlist-page">
      <div className="wishlist-header">
        <div className="wishlist-header-text">
          <h1>
            <span className="wishlist-heart">❤️</span> My Medicine Wishlist
          </h1>
          <p className="wishlist-sub">
            {items.length > 0
              ? `${items.length} medicine${items.length === 1 ? "" : "s"} saved`
              : "No medicines saved yet"}
          </p>
        </div>
        <button
          className="wishlist-browse-btn"
          onClick={() => navigate("/search")}
        >
          + Browse Medicines
        </button>
      </div>

      {error && <div className="wishlist-error">{error}</div>}

      {loadingItems ? (
        <div className="wishlist-loading-screen">
          <div className="wishlist-spinner" />
          <p>Loading your wishlist...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="wishlist-empty">
          <div className="wishlist-empty-icon">💊</div>
          <h2>Your wishlist is empty</h2>
          <p>Find medicines on the search page and click the heart button to save them here.</p>
          <button
            className="wishlist-login-btn"
            onClick={() => navigate("/search")}
          >
            Search Medicines
          </button>
        </div>
      ) : (
        <div className="wishlist-grid">
          {items.map((item) => (
            <div key={item.medicine_id} className="wishlist-card">
              <div className="wishlist-card-img-wrap">
                {item.image ? (
                  <img src={item.image} alt={item.name} />
                ) : (
                  <div className="wishlist-card-img-placeholder">💊</div>
                )}
              </div>

              <div className="wishlist-card-body">
                <h3 className="wishlist-card-name" title={item.name}>
                  {item.name || "Unknown Medicine"}
                </h3>

                <div className="wishlist-card-tags">
                  {item.category && (
                    <span className="wl-tag">{item.category}</span>
                  )}
                  {item.therapeutic_class && (
                    <span className="wl-tag wl-tag-blue">{item.therapeutic_class}</span>
                  )}
                </div>

                {item.manufacturer_name && (
                  <p className="wishlist-card-mfg">
                    🏭 {item.manufacturer_name}
                  </p>
                )}
                {item.salt && (
                  <p className="wishlist-card-salt">
                    🧪 {item.salt}
                  </p>
                )}

                <div className="wishlist-card-footer">
                  <span className="wishlist-card-price">
                    {item.price != null ? `₹${item.price}` : "Price N/A"}
                  </span>

                  <div className="wishlist-card-actions">
                    <button
                      className="wl-view-btn"
                      onClick={() =>
                        navigate("/search", {
                          state: { medicine: item.name },
                        })
                      }
                    >
                      View
                    </button>
                    <button
                      className="wl-remove-btn"
                      disabled={removingId === item.medicine_id}
                      onClick={() => handleRemove(item.medicine_id)}
                    >
                      {removingId === item.medicine_id ? "..." : "🗑 Remove"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WishList;
