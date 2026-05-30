import React, { useState } from "react";
import "./HealthTips.css";
import adhoMukhasanImage from "../../assets/adhomukhasan.jpeg";
import balasanImage from "../../assets/balasan.jpeg";
import bhujangasanImage from "../../assets/bhujangasan.jpeg";
import sarvangasanImage from "../../assets/sarvangasan.jpeg";
import tadasanaImage from "../../assets/tadasana.jpeg";
import vrikaasanaImage from "../../assets/vrikaasana.jpeg";

// New Assets
import healthyFoodsHero from "../../assets/healthy_foods_hero.png";
import vitaminsMineralsHero from "../../assets/vitamins_minerals_hero.png";
import generalHealthHero from "../../assets/general_health_hero.png";
import dhanurasanaImage from "../../assets/dhanurasana.png";
import vajrasanaImage from "../../assets/vajrasana.png";
import paschimottanasanaImage from "../../assets/paschimottanasana.png";

const yogaPoses = [
  {
    id: "tadasana",
    name: "Tadasana",
    englishName: "Mountain Pose",
    image: tadasanaImage,
    level: "Beginner",
    duration: "30-60 seconds",
    focus: "Posture & Balance",
    muscles: "Core, Thighs, Ankles",
    benefits: [
      "Improves posture and balance",
      "Strengthens thighs, knees, and ankles",
      "Engages core muscles",
      "Foundation for all standing poses"
    ],
    instructions: [
      "Stand with feet together, big toes touching",
      "Lift and spread your toes, then place them back down",
      "Engage your thigh muscles and lift your kneecaps",
      "Lift your chest and roll your shoulders back",
      "Keep your arms at your sides with palms facing forward",
      "Breathe deeply and hold the pose"
    ],
    mistakes: ["Leaning too far forward or back", "Locking the knees", "Holding the breath"],
    tips: "Focus on grounding through your feet while lifting through your crown"
  },
  {
    id: "bhujangasana",
    name: "Bhujangasana",
    englishName: "Cobra Pose",
    image: bhujangasanImage,
    level: "Beginner",
    duration: "20-30 seconds",
    focus: "Spinal Flexibility",
    muscles: "Lower Back, Chest, Shoulders",
    benefits: [
      "Strengthens back muscles",
      "Opens chest and shoulders",
      "Improves spinal flexibility",
      "Relieves back pain from sitting"
    ],
    instructions: [
      "Lie on your stomach with legs extended",
      "Place palms under your shoulders, elbows close to body",
      "Press the tops of your feet into the mat",
      "Inhale and lift your chest off the ground",
      "Keep your elbows bent and close to your sides",
      "Gaze forward or slightly upward"
    ],
    mistakes: ["Over-arching the lower back", "Tensing the shoulders", "Lifting the hips too high"],
    tips: "Keep your lower ribs on the ground and avoid over-arching your back",
    caution: "Avoid if you have severe back pain or are pregnant"
  },
  {
    id: "adho-mukha-svanasana",
    name: "Adho Mukha Svanasana",
    englishName: "Downward Dog",
    image: adhoMukhasanImage,
    level: "Beginner",
    duration: "30-60 seconds",
    focus: "Full Body Stretch",
    muscles: "Hamstrings, Calves, Arms",
    benefits: [
      "Stretches hamstrings and calves",
      "Strengthens arms and shoulders",
      "Improves circulation",
      "Calms the mind"
    ],
    instructions: [
      "Start on hands and knees (tabletop position)",
      "Spread your fingers wide and press through your palms",
      "Lift your hips up and back, straightening your legs",
      "Keep your head between your arms",
      "Press your heels toward the ground",
      "Breathe deeply and hold the pose"
    ],
    mistakes: ["Rounding the back", "Bending the knees too much", "Not engaging the core"],
    tips: "It's okay if your heels don't touch the ground - focus on lengthening your spine"
  },
  {
    id: "balasana",
    name: "Balasana",
    englishName: "Child's Pose",
    image: balasanImage,
    level: "Beginner",
    duration: "1-3 minutes",
    focus: "Rest & Recovery",
    muscles: "Hips, Lower Back, Shoulders",
    benefits: [
      "Gentle stretch for back and hips",
      "Calms the nervous system",
      "Relieves stress and fatigue",
      "Great recovery pose"
    ],
    instructions: [
      "Kneel on the mat with big toes touching",
      "Separate your knees hip-width apart",
      "Sit back on your heels",
      "Fold forward, bringing your chest toward your thighs",
      "Extend your arms forward or rest them by your sides",
      "Rest your forehead on the mat"
    ],
    mistakes: ["Holding tension in the neck", "Forcing the forehead down", "Not breathing deeply"],
    tips: "This is a resting pose - stay as long as you need to feel refreshed"
  },
  {
    id: "vrikshasana",
    name: "Vrikshasana",
    englishName: "Tree Pose",
    image: vrikaasanaImage,
    level: "Beginner",
    duration: "20-30 seconds each side",
    focus: "Balance & Concentration",
    muscles: "Ankles, Calves, Core",
    benefits: [
      "Improves balance and focus",
      "Strengthens legs and ankles",
      "Opens hips",
      "Enhances concentration"
    ],
    instructions: [
      "Stand in Tadasana (Mountain Pose)",
      "Shift your weight to your left foot",
      "Bend your right knee and place the sole of your right foot on your left inner thigh",
      "Bring your hands to prayer position at your heart",
      "Focus on a point in front of you for balance",
      "Hold the pose, then switch sides"
    ],
    mistakes: ["Placing the foot on the knee joint", "Arching the lower back", "Looking down"],
    tips: "If you can't reach your thigh, place your foot on your column (never on your knee)"
  },
  {
    id: "sarvangasana",
    name: "Sarvangasana",
    englishName: "Shoulder Stand",
    image: sarvangasanImage,
    level: "Intermediate",
    duration: "30-60 seconds",
    focus: "Thyroid & Circulation",
    muscles: "Shoulders, Upper Back, Core",
    benefits: [
      "Improves blood circulation",
      "Strengthens shoulders and back",
      "Calms the nervous system",
      "Helps with thyroid function"
    ],
    instructions: [
      "Lie on your back with arms by your sides",
      "Lift your legs up toward the ceiling",
      "Support your lower back with your hands",
      "Lift your hips and legs up, keeping them straight",
      "Keep your chin tucked toward your chest",
      "Hold the pose, then slowly lower down"
    ],
    mistakes: ["Moving the neck in the pose", "Collapsing the back", "Not using hands for support"],
    tips: "This is an inverted pose - avoid if you have neck or shoulder issues",
    caution: "Not recommended for beginners or those with neck problems"
  },
  {
    id: "dhanurasana",
    name: "Dhanurasana",
    englishName: "Bow Pose",
    image: dhanurasanaImage,
    level: "Intermediate",
    duration: "20-30 seconds",
    focus: "Core & Spinal Strength",
    muscles: "Back, Abs, Thighs",
    benefits: ["Strengthens abdominal muscles", "Improves digestion", "Opens heart and chest"],
    instructions: [
      "Lie on your stomach with feet hip-width apart",
      "Bend your knees and hold your ankles with your hands",
      "Inhale and lift your chest and thighs off the ground",
      "Pull with your hands to create a bow shape",
      "Look forward and breathe evenly"
    ],
    mistakes: ["Holding the breath", "Gripping too tight", "Forcing the lift"],
    tips: "Keep your knees as close together as comfortably possible."
  },
  {
    id: "vajrasana",
    name: "Vajrasana",
    englishName: "Thunderbolt Pose",
    image: vajrasanaImage,
    level: "Beginner",
    duration: "5-10 minutes",
    focus: "Digestion & Focus",
    muscles: "Thighs, Knees, Spine",
    benefits: ["Improves digestion", "Calms the mind", "Strengthens pelvic muscles"],
    instructions: [
      "Kneel on the floor with knees together",
      "Sit back on your heels",
      "Keep your spine straight and hands on your knees",
      "Close your eyes and breathe deeply"
    ],
    mistakes: ["Slumping the shoulders", "Over-arching the back"],
    tips: "This is the only pose that can be done right after a meal to aid digestion."
  },
  {
    id: "paschimottanasana",
    name: "Paschimottanasana",
    englishName: "Seated Forward Bend",
    image: paschimottanasanaImage,
    level: "Beginner",
    duration: "30-60 seconds",
    focus: "Hamstrings & Spine",
    muscles: "Hamstrings, Spine, Lower Back",
    benefits: ["Calms the brain", "Stretches the whole back body", "Relieves stress"],
    instructions: [
      "Sit with legs extended forward",
      "Inhale and reach your arms up",
      "Exhale and fold forward from the hips",
      "Hold your feet or shins",
      "Keep the spine long as you fold"
    ],
    mistakes: ["Rounding the upper back", "Pulling too hard with arms"],
    tips: "Focus on bringing your chest toward your shins rather than your head to your knees."
  },
  {
    id: "savasana",
    name: "Savasana",
    englishName: "Corpse Pose",
    image: balasanImage, // Placeholder for lack of new image
    level: "Beginner",
    duration: "5-10 minutes",
    focus: "Total Relaxation",
    muscles: "Full Body (Resting)",
    benefits: ["Reduces blood pressure", "Deep relaxation", "Integrates the benefits of practice"],
    instructions: [
      "Lie flat on your back",
      "Arms by your sides with palms facing up",
      "Feet naturally falling open",
      "Close your eyes and let go of all tension"
    ],
    mistakes: ["Fidgeting", "Falling asleep (try to stay conscious)", "Thinking too much"],
    tips: "Let your breath be natural and observe it without control."
  }
];

const healthyFoods = [
  {
    id: "leafy-greens",
    name: "Leafy Greens",
    category: "Vegetables",
    icon: "🥬",
    benefits: ["High in Vitamin K", "Supports bone health", "Rich in fiber"],
    description: "Spinach, kale, and microgreens are nutritional powerhouses packed with essential minerals."
  },
  {
    id: "berries",
    name: "Berries",
    category: "Fruits",
    icon: "🫐",
    benefits: ["Rich in antioxidants", "Improves heart health", "Anti-inflammatory"],
    description: "Blueberries and strawberries help combat oxidative stress and keep your heart healthy."
  },
  {
    id: "fatty-fish",
    name: "Fatty Fish",
    category: "Proteins",
    icon: "🐟",
    benefits: ["Omega-3 fatty acids", "Brain health", "Reduces inflammation"],
    description: "Salmon and mackerel provide essential fats that are crucial for cognitive function."
  },
  {
    id: "whole-grains",
    name: "Whole Grains",
    category: "Carbs",
    icon: "🌾",
    benefits: ["Sustained energy", "High fiber", "Digestive health"],
    description: "Quinoa and oats provide complex carbohydrates for long-lasting energy throughout the day."
  },
  {
    id: "avocados",
    name: "Avocados",
    category: "Healthy Fats",
    icon: "🥑",
    benefits: ["Monounsaturated fats", "Heart health", "High potassium"],
    description: "Avocados are rich in healthy fats that help absorb other nutrients and keep you full."
  },
  {
    id: "nuts-seeds",
    name: "Nuts & Seeds",
    category: "Healthy Fats",
    icon: "🥜",
    benefits: ["Brain health", "Vitamin E", "Mineral rich"],
    description: "Almonds, walnuts, and chia seeds are perfect for snacking and boosting brain function."
  },
  {
    id: "greek-yogurt",
    name: "Greek Yogurt",
    category: "Dairy/Probiotic",
    icon: "🍦",
    benefits: ["Probiotics", "High protein", "Calcium"],
    description: "Essential for gut health and muscle repair after exercise."
  },
  {
    id: "sweet-potatoes",
    name: "Sweet Potatoes",
    category: "Vegetables",
    icon: "🍠",
    benefits: ["Beta-carotene", "Fiber", "Sustained energy"],
    description: "A great source of Vitamin A which supports eye health and immune function."
  },
  {
    id: "garlic",
    name: "Garlic",
    category: "Scent/Herb",
    icon: "🧄",
    benefits: ["Allicin", "Immune boost", "Blood pressure"],
    description: "Garlic has powerful medicinal properties and supports heart health."
  },
  {
    id: "green-tea",
    name: "Green Tea",
    category: "Beverage",
    icon: "🍵",
    benefits: ["Catechins", "Metabolism boost", "Focus"],
    description: "Rich in antioxidants that can improve brain function and fat loss."
  }
];

const vitaminsMinerals = [
  {
    id: "vit-d",
    name: "Vitamin D",
    source: "Sunlight, Fatty Fish",
    role: "Bone Health & Immunity",
    deficiency: "Fatigue, bone pain",
    icon: "☀️"
  },
  {
    id: "vit-c",
    name: "Vitamin C",
    source: "Citrus, Peppers",
    role: "Skin & Immune Function",
    deficiency: "Slow healing, dry skin",
    icon: "🍋"
  },
  {
    id: "iron",
    name: "Iron",
    source: "Spinach, Red Meat",
    role: "Blood Oxygen Transport",
    deficiency: "Anemia, dizziness",
    icon: "🩸"
  },
  {
    id: "calcium",
    name: "Calcium",
    source: "Dairy, Leafy Greens",
    role: "Strong Bones & Teeth",
    deficiency: "Weak bones",
    icon: "🥛"
  },
  {
    id: "magnesium",
    name: "Magnesium",
    source: "Nuts, Dark Chocolate",
    role: "Muscle & Nerve Function",
    deficiency: "Cramps, anxiety",
    icon: "🍫"
  },
  {
    id: "zinc",
    name: "Zinc",
    source: "Shellfish, Seeds",
    role: "Immune System & Metabolism",
    deficiency: "Loss of taste, slow healing",
    icon: "🦪"
  },
  {
    id: "vit-b12",
    name: "Vitamin B12",
    source: "Eggs, Meat, Fortified food",
    role: "Nerve function & DNA",
    deficiency: "Nerve damage, fatigue",
    icon: "🥚"
  },
  {
    id: "potassium",
    name: "Potassium",
    source: "Bananas, Potatoes",
    role: "Fluid balance & Heart",
    deficiency: "High blood pressure",
    icon: "🍌"
  },
  {
    id: "vit-a",
    name: "Vitamin A",
    source: "Carrots, Liver",
    role: "Vision & Immune System",
    deficiency: "Night blindness",
    icon: "🥕"
  },
  {
    id: "vit-e",
    name: "Vitamin E",
    source: "Sunflower oil, Almonds",
    role: "Antioxidant, Skin protection",
    deficiency: "Muscle weakness",
    icon: "🌻"
  }
];

const generalTips = [
  {
    id: "hydration",
    title: "Stay Hydrated",
    text: "Drink at least 8-10 glasses of water daily to maintain energy and focus.",
    icon: "💧",
    color: "#3b82f6"
  },
  {
    id: "sleep",
    title: "Quality Sleep",
    text: "Aim for 7-9 hours of restful sleep to allow your body to recover and recharge.",
    icon: "😴",
    color: "#6366f1"
  },
  {
    id: "exercise",
    title: "Daily Movement",
    text: "At least 30 minutes of moderate activity like walking can boost your mood significantly.",
    icon: "🏃‍♂️",
    color: "#10b981"
  },
  {
    id: "posture",
    title: "Mindful Posture",
    text: "Keep your spine aligned while sitting to prevent long-term back and neck issues.",
    icon: "🧘",
    color: "#f59e0b"
  },
  {
    id: "breathing",
    title: "Box Breathing",
    text: "Inhale for 4s, hold 4s, exhale 4s, hold 4s. Instantly calms your nervous system.",
    icon: "🌬️",
    color: "#06b6d4"
  },
  {
    id: "detox",
    title: "Digital Detox",
    text: "Turn off screens 1 hour before bed to improve your circadian rhythm and sleep quality.",
    icon: "📵",
    color: "#ef4444"
  },
  {
    id: "sunlight",
    title: "Morning Sunlight",
    text: "15 mins of sun exposure in the morning sets your internal clock and boosts mood.",
    icon: "🌇",
    color: "#fbbf24"
  },
  {
    id: "stretching",
    title: "Desk Stretching",
    text: "Stand up and stretch every hour to prevent stiffness and improve blood flow.",
    icon: "🧍",
    color: "#8b5cf6"
  },
  {
    id: "social",
    title: "Social Connection",
    text: "Talking to a friend or loved one for 10 mins daily can lower stress levels significantly.",
    icon: "🤝",
    color: "#ec4899"
  },
  {
    id: "laughter",
    title: "Laughter Therapy",
    text: "Watch something funny. Laughter reduces cortisol and strengthens your immune system.",
    icon: "😂",
    color: "#fb923c"
  }
];

const PoseCard = ({ pose }) => {
  const handleClick = () => {
    const newWindow = window.open('', '_blank');
    newWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${pose.name} - ${pose.englishName}</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; color: #1e293b; background: #f8fafc; }
            .report-card { background: white; padding: 40px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
            .header { text-align: center; margin-bottom: 30px; padding: 30px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; border-radius: 15px; }
            .pose-image { width: 100%; max-width: 500px; height: 350px; object-fit: cover; border-radius: 12px; margin: 20px auto; display: block; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 25px 0; }
            .meta-item { background: #f1f5f9; padding: 15px; border-radius: 10px; text-align: center; border-bottom: 3px solid #6366f1; }
            .meta-item strong { display: block; color: #6366f1; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 5px; }
            .section { margin: 35px 0; }
            .section h3 { color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px; }
            .list { list-style: none; padding: 0; }
            .list li { margin: 12px 0; padding-left: 25px; position: relative; }
            .list li::before { content: "•"; color: #6366f1; font-weight: bold; position: absolute; left: 0; font-size: 1.5rem; line-height: 1; }
            .mistakes-box { background: #fff1f2; border: 1px solid #fecdd3; padding: 15px; border-radius: 10px; color: #be123c; }
            .tips-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 10px; color: #15803d; margin-top: 20px; }
            .footer { text-align: center; margin-top: 40px; font-size: 0.9rem; color: #64748b; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="report-card">
            <div class="header">
              <h1 style="margin:0">${pose.name}</h1>
              <p style="margin:5px 0 0 0; opacity:0.9">${pose.englishName}</p>
            </div>
            
            <img src="${pose.image}" alt="${pose.name}" class="pose-image">
            
            <div class="meta-grid">
              <div class="meta-item"><strong>Level</strong>${pose.level}</div>
              <div class="meta-item"><strong>Duration</strong>${pose.duration}</div>
              <div class="meta-item"><strong>Focus</strong>${pose.focus}</div>
            </div>

            <div class="section">
              <h3>Targeted Muscles</h3>
              <p>${pose.muscles}</p>
            </div>
            
            <div class="section">
              <h3>Health Benefits</h3>
              <ul class="list">${pose.benefits.map(b => `<li>${b}</li>`).join('')}</ul>
            </div>
            
            <div class="section">
              <h3>Step-by-Step Instructions</h3>
              <ol style="padding-left:20px">${pose.instructions.map(i => `<li style="margin:10px 0">${i}</li>`).join('')}</ol>
            </div>
            
            <div class="mistakes-box">
              <strong>⚠️ Common Mistakes:</strong>
              <ul style="margin:10px 0 0 0; padding-left:20px">${pose.mistakes.map(m => `<li>${m}</li>`).join('')}</ul>
            </div>
            
            <div class="tips-box">
              <strong>💡 Pro Tip:</strong> ${pose.tips}
            </div>

            <p class="footer">Disclaimer: Yoga should be practiced under guidance if you are a beginner. Listen to your body and never force a pose.</p>
          </div>
        </body>
      </html>
    `);
    newWindow.document.close();
  };

  return (
    <div className="pose-card" onClick={handleClick}>
      <div className="pose-image-container">
        <img src={pose.image} alt={pose.name} className="pose-image" />
        <div className="pose-overlay">
          <span className="view-details">Full Report</span>
        </div>
      </div>
      <div className="pose-info">
        <div className="pose-header">
          <h3>{pose.name}</h3>
          <span className="focus-badge">{pose.focus}</span>
        </div>
        <p className="english-name">{pose.englishName}</p>
        <div className="pose-badges">
          <span className="level-badge">{pose.level}</span>
          <span className="duration-badge">{pose.duration}</span>
        </div>
      </div>
    </div>
  );
};

const TipCard = ({ tip, type }) => {
  if (type === "food") {
    return (
      <div className="tip-card food-card">
        <div className="tip-icon">{tip.icon}</div>
        <div className="tip-content">
          <span className="tip-category">{tip.category}</span>
          <h3>{tip.name}</h3>
          <p>{tip.description}</p>
          <ul className="tip-benefits">
            {tip.benefits.map((b, i) => <li key={i}>• {b}</li>)}
          </ul>
        </div>
      </div>
    );
  }
  if (type === "vitamin") {
    return (
      <div className="tip-card vitamin-card">
        <div className="tip-icon">{tip.icon}</div>
        <div className="tip-content">
          <h3>{tip.name}</h3>
          <p><strong>Role:</strong> {tip.role}</p>
          <p><strong>Sources:</strong> {tip.source}</p>
          <div className="deficiency-warning">
            <strong>If deficient:</strong> {tip.deficiency}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="tip-card general-card" style={{ borderColor: tip.color }}>
      <div className="tip-icon" style={{ backgroundColor: tip.color + "20", color: tip.color }}>{tip.icon}</div>
      <div className="tip-content">
        <h3>{tip.title}</h3>
        <p>{tip.text}</p>
      </div>
    </div>
  );
};

const HealthTips = () => {
  const [activeTab, setActiveTab] = useState("yoga");

  const tabs = [
    { id: "yoga", label: "Yoga Poses", icon: "🧘" },
    { id: "food", label: "Healthy Food", icon: "🥗" },
    { id: "vitamins", label: "Vitamins", icon: "💊" },
    { id: "general", label: "General Tips", icon: "💡" }
  ];

  const getHeroContent = () => {
    switch (activeTab) {
      case "food":
        return {
          title: "🥗 Nutrition & Healthy Foods",
          text: "Fuel your body with the right nutrients for optimal performance and health.",
          image: healthyFoodsHero,
          class: "hero-food"
        };
      case "vitamins":
        return {
          title: "💊 Vitamins & Minerals",
          text: "Essential micronutrients your body needs to thrive and stay resilient.",
          image: vitaminsMineralsHero,
          class: "hero-vitamins"
        };
      case "general":
        return {
          title: "💡 General Wellness Tips",
          text: "Simple daily habits that can lead to a longer, healthier life.",
          image: generalHealthHero,
          class: "hero-general"
        };
      default:
        return {
          title: "🧘 Yoga for Wellness",
          text: "Ancient poses to improve flexibility, strength, and mental clarity.",
          image: null,
          class: "hero-yoga"
        };
    }
  };

  const hero = getHeroContent();

  return (
    <div className="health-tips-container">
      <div className="tabs-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <header className={`health-hero ${hero.class}`} style={hero.image ? { backgroundImage: `url(${hero.image})` } : {}}>
        <div className="hero-overlay">
          <h1>{hero.title}</h1>
          <p>{hero.text}</p>
        </div>
      </header>

      <div className="content-section">
        {activeTab === "yoga" && (
          <div className="poses-grid">
            {yogaPoses.map((pose) => (
              <PoseCard key={pose.id} pose={pose} />
            ))}
          </div>
        )}

        {activeTab === "food" && (
          <div className="tips-grid">
            {healthyFoods.map((food) => (
              <TipCard key={food.id} tip={food} type="food" />
            ))}
          </div>
        )}

        {activeTab === "vitamins" && (
          <div className="tips-grid">
            {vitaminsMinerals.map((vit) => (
              <TipCard key={vit.id} tip={vit} type="vitamin" />
            ))}
          </div>
        )}

        {activeTab === "general" && (
          <div className="tips-grid">
            {generalTips.map((tip) => (
              <TipCard key={tip.id} tip={tip} type="general" />
            ))}
          </div>
        )}
      </div>

      {activeTab === "yoga" && (
        <div className="safety-note">
          <h3>Safety First</h3>
          <ul>
            <li>Always warm up before practicing yoga</li>
            <li>Listen to your body and don't push beyond your limits</li>
            <li>If you have any medical conditions, consult your doctor first</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default HealthTips;


