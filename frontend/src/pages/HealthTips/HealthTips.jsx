import React from "react";
import "./HealthTips.css";

const yogaPoses = [
  {
    id: "tadasana",
    name: "Tadasana",
    englishName: "Mountain Pose",
    image: "https://media.istockphoto.com/photos/beautiful-young-woman-practices-yoga-asana-tadasana-mountain-pose-on-picture-id1165120121?k=20&m=1165120121&s=612x612&w=0&h=ZiV2uwgR6hYneAftD2XoE7SF4uJnyR7Lfy3Hp1-1VeA=",
    level: "Beginner",
    duration: "30-60 seconds",
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
    tips: "Focus on grounding through your feet while lifting through your crown"
  },
  {
    id: "bhujangasana",
    name: "Bhujangasana",
    englishName: "Cobra Pose",
    image: "https://th.bing.com/th/id/R.89e15c1d454715da4126ea3e425e624e?rik=SPkqZc5cXNCJAQ&riu=http%3a%2f%2fcdn2.stylecraze.com%2fwp-content%2fuploads%2f2013%2f08%2fBhujangasana-2.jpg&ehk=cuI3usGBYGbdARKdP4BOoayM30dag9D94P3qIyuVtoQ%3d&risl=&pid=ImgRaw&r=0",
    level: "Beginner",
    duration: "20-30 seconds",
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
    tips: "Keep your lower ribs on the ground and avoid over-arching your back",
    caution: "Avoid if you have severe back pain or are pregnant"
  },
  {
    id: "adho-mukha-svanasana",
    name: "Adho Mukha Svanasana",
    englishName: "Downward Dog",
    image: "https://tse2.mm.bing.net/th/id/OIP.TqwPT_zNQYamzI9D2A8nQgHaFj?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
    level: "Beginner",
    duration: "30-60 seconds",
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
    tips: "It's okay if your heels don't touch the ground - focus on lengthening your spine"
  },
  {
    id: "balasana",
    name: "Balasana",
    englishName: "Child's Pose",
    image: "https://tse1.mm.bing.net/th/id/OIP.J_7nKmlGcLEAwLhNAScpeQHaE8?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
    level: "Beginner",
    duration: "1-3 minutes",
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
    tips: "This is a resting pose - stay as long as you need to feel refreshed"
  },
  {
    id: "vrikshasana",
    name: "Vrikshasana",
    englishName: "Tree Pose",
    image: "https://tse1.mm.bing.net/th/id/OIP.DHDdMVmi-Do9uIT_93t12gHaEK?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
    level: "Beginner",
    duration: "20-30 seconds each side",
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
    tips: "If you can't reach your thigh, place your foot on your calf (never on your knee)"
  },
  {
    id: "sarvangasana",
    name: "Sarvangasana",
    englishName: "Shoulder Stand",
    image: "https://tse1.mm.bing.net/th/id/OIP.ca3opz0sfyz7ql0uL490wgHaE8?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
    level: "Intermediate",
    duration: "30-60 seconds",
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
    tips: "This is an inverted pose - avoid if you have neck or shoulder issues",
    caution: "Not recommended for beginners or those with neck problems"
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
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              line-height: 1.6;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border-radius: 10px;
            }
            .pose-image {
              width: 100%;
              max-width: 400px;
              height: 300px;
              object-fit: cover;
              border-radius: 10px;
              margin: 20px 0;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin: 20px 0;
            }
            .info-card {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              border-left: 4px solid #667eea;
            }
            .level-badge {
              display: inline-block;
              padding: 5px 12px;
              background: #e3f2fd;
              color: #1976d2;
              border-radius: 20px;
              font-size: 0.9em;
              font-weight: bold;
            }
            .duration-badge {
              display: inline-block;
              padding: 5px 12px;
              background: #f3e5f5;
              color: #7b1fa2;
              border-radius: 20px;
              font-size: 0.9em;
              font-weight: bold;
            }
            .section {
              margin: 25px 0;
            }
            .section h3 {
              color: #667eea;
              border-bottom: 2px solid #667eea;
              padding-bottom: 5px;
            }
            .benefits-list, .instructions-list {
              padding-left: 20px;
            }
            .benefits-list li {
              margin: 8px 0;
              color: #2e7d32;
            }
            .instructions-list li {
              margin: 12px 0;
              padding: 8px;
              background: #f5f5f5;
              border-radius: 5px;
            }
            .tips-box {
              background: #fff3e0;
              border: 1px solid #ffb74d;
              padding: 15px;
              border-radius: 8px;
              margin: 15px 0;
            }
            .caution-box {
              background: #ffebee;
              border: 1px solid #ef5350;
              padding: 15px;
              border-radius: 8px;
              margin: 15px 0;
              color: #c62828;
            }
            @media (max-width: 600px) {
              .info-grid {
                grid-template-columns: 1fr;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${pose.name} (${pose.englishName})</h1>
            <p>Level: <span class="level-badge">${pose.level}</span> | Duration: <span class="duration-badge">${pose.duration}</span></p>
          </div>
          
          <img src="${pose.image}" alt="${pose.name}" class="pose-image">
          
          <div class="info-grid">
            <div class="info-card">
              <h3>Level</h3>
              <p>${pose.level}</p>
            </div>
            <div class="info-card">
              <h3>Duration</h3>
              <p>${pose.duration}</p>
            </div>
          </div>
          
          <div class="section">
            <h3>Benefits</h3>
            <ul class="benefits-list">
              ${pose.benefits.map(benefit => `<li>✅ ${benefit}</li>`).join('')}
            </ul>
          </div>
          
          <div class="section">
            <h3>How to Do It</h3>
            <ol class="instructions-list">
              ${pose.instructions.map(instruction => `<li>${instruction}</li>`).join('')}
            </ol>
          </div>
          
          <div class="tips-box">
            <strong>💡 Pro Tip:</strong> ${pose.tips}
          </div>
          
          ${pose.caution ? `<div class="caution-box">
            <strong>⚠️ Caution:</strong> ${pose.caution}
          </div>` : ''}
          
          <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 8px;">
            <p><strong>Remember:</strong> Listen to your body. If you feel any pain or discomfort, stop immediately and consult a yoga instructor or healthcare professional.</p>
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
          <span className="view-details">Click to View Details</span>
        </div>
      </div>
      <div className="pose-info">
        <h3>{pose.name}</h3>
        <p className="english-name">{pose.englishName}</p>
        <div className="pose-badges">
          <span className="level-badge">{pose.level}</span>
          <span className="duration-badge">{pose.duration}</span>
        </div>
      </div>
    </div>
  );
};

const HealthTips = () => {
  return (
    <div className="health-tips">
      <header className="hero">
        <div>
          <h1>🧘 Yoga Poses for Health & Wellness</h1>
          <p>Click on any pose to see detailed instructions, benefits, and step-by-step guidance.</p>
        </div>
      </header>

      <div className="poses-grid">
        {yogaPoses.map((pose) => (
          <PoseCard key={pose.id} pose={pose} />
        ))}
      </div>

      <div className="safety-note">
        <h3>Safety First</h3>
        <ul>
          <li>Always warm up before practicing yoga</li>
          <li>Listen to your body and don't push beyond your limits</li>
          <li>If you have any medical conditions, consult your doctor first</li>
          <li>Consider taking a class with a certified instructor to learn proper form</li>
        </ul>
      </div>
    </div>
  );
};

export default HealthTips;
