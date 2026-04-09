import React, { useContext, useEffect, useState } from "react";
import "./ProductView.css";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { StoreContext } from "../../context/StoreContext";
import { assets } from "../../assets/assets";
import { getMedicineById } from "../../api/medicineApi";

const ProductView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { addToWish, removeFromWish, wishItems } = useContext(StoreContext);
  const [medicine, setMedicine] = useState(location.state?.product ?? null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadMedicine() {
      try {
        setLoading(true);
        setError("");
        const response = await getMedicineById(id);

        if (!isMounted) {
          return;
        }

        setMedicine(response?.data ?? null);
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }

        console.error("Failed to load medicine details:", fetchError);
        setError("Unable to load medicine details.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadMedicine();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const medicineId = medicine?.id ?? medicine?._id;
  const isInWishlist = medicineId ? wishItems[medicineId] : false;

  const handleWishlistClick = () => {
    if (!medicineId) {
      return;
    }

    if (isInWishlist) {
      removeFromWish(medicineId);
    } else {
      addToWish(medicineId);
    }
  };

  if (loading) {
    return <div className="product-view">Loading medicine details...</div>;
  }

  if (error) {
    return <div className="product-view">{error}</div>;
  }

  if (!medicine) {
    return <div className="product-view">Medicine not found.</div>;
  }

  const compositionItems = [
    medicine.short_composition1,
    medicine.short_composition2,
  ].filter(Boolean);

  const overviewItems = [
    ["Category", medicine.category],
    ["Manufacturer", medicine.manufacturer_name],
    ["Type", medicine.type],
    ["Pack Size", medicine.pack_size_label],
    ["Salt", medicine.salt],
    ["Salt Composition", medicine.salt_composition],
    ["Chemical Class", medicine.chemical_class],
    ["Therapeutic Class", medicine.therapeutic_class],
    ["Action Class", medicine.action_class],
    [
      "Habit Forming",
      typeof medicine.habit_forming === "boolean"
        ? medicine.habit_forming
          ? "Yes"
          : "No"
        : null,
    ],
  ].filter(([, value]) => value);

  const detailSections = [
    ["Description", medicine.medicine_desc],
    ["Information", medicine.info],
    ["Benefits", medicine.benefits],
    ["How It Works", medicine.working],
    ["Usage", medicine.usage],
    ["Safety Advice", medicine.safetyadvice],
    ["Drug Interactions", medicine.drug_interactions],
    ["Common Side Effects", medicine.sideeffects],
    ["Side Effects", medicine.side_effects],
  ].filter(([, value]) => value);

  const relatedSections = [
    ["Composition", compositionItems],
    ["Salts", medicine.salts],
    ["Uses", medicine.uses],
  ].filter(([, items]) => Array.isArray(items) && items.length > 0);

  return (
    <div className="product-view">
      <div className="product-view-container">
        <div className="product-view-left">
          <div className="product-view-img">
            <img src={medicine.image || assets.image1} alt={medicine.name} />
          </div>
        </div>

        <div className="product-view-right">
          <div className="product-view-header">
            <h1>{medicine.name}</h1>
            <button
              className={`wishlist-btn ${isInWishlist ? "in-wishlist" : ""}`}
              onClick={handleWishlistClick}
            >
              <img
                src={isInWishlist ? assets.remove_icon_red : assets.wish}
                alt="wishlist"
              />
              {isInWishlist ? "Remove from Wishlist" : "Add to Wishlist"}
            </button>
          </div>

          <div className="product-view-rating">
            <img src={assets.rating_starts} alt="rating" />
            <p>Dataset-backed medicine profile</p>
          </div>

          <div className="product-view-price">
            <h2>
              {medicine.price != null ? `₹${medicine.price}` : "Price unavailable"}
            </h2>
            {medicine.link ? (
              <a
                className="buy-link"
                href={medicine.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open purchase link
              </a>
            ) : null}
          </div>

          {overviewItems.length > 0 ? (
            <div className="product-view-meta">
              {overviewItems.map(([label, value]) => (
                <div className="meta-pill" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          ) : null}

          <div className="product-view-info">
            <h3>Medicine Overview</h3>
            {detailSections.length > 0 ? (
              detailSections.map(([label, value]) => (
                <div className="info-section" key={label}>
                  <h4>{label}</h4>
                  <p>{value}</p>
                </div>
              ))
            ) : (
              <p>No detailed information available.</p>
            )}
          </div>

          {relatedSections.length > 0 ? (
            <div className="product-view-related">
              <h3>Related Data</h3>
              {relatedSections.map(([label, items]) => (
                <div className="related-section" key={label}>
                  <h4>{label}</h4>
                  <div className="related-list">
                    {items.map((item) => (
                      <span className="related-pill" key={`${label}-${item}`}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {medicine.substitute_details?.length ? (
            <div className="product-view-related">
              <h3>Substitutes</h3>
              <div className="related-list">
                {medicine.substitute_details.map((item) => (
                  <button
                    key={`substitute-${item.id}`}
                    type="button"
                    className="related-pill substitute-link"
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
          ) : medicine.substitutes?.length ? (
            <div className="product-view-related">
              <h3>Substitutes</h3>
              <div className="related-list">
                {medicine.substitutes.map((item) => (
                  <button
                    type="button"
                    className="related-pill substitute-link"
                    key={`substitute-name-${item}`}
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

          <div className="product-view-actions">
            <a className="add-to-cart" href="/search">
              Browse More Medicines
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductView;
