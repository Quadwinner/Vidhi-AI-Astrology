import "./PaymentSuccess.css";
// import { FaCheckCircle } from "react-icons/fa";

const PaymentSuccess = () => {
  return (
    <div className="payment-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="logo">🌌 AstroAura</div>

        <div className="status-card">
          <div className="status-icon success">✔</div>
          <h4>Payment Successful</h4>
          <p className="plan">Annual Premium Plan</p>
          <p className="activation">Activated Successfully ✅</p>

          <div className="details">
            <p><strong>Transaction ID:</strong> AAP7789-009</p>
            <p><strong>Payment Method:</strong> UPI</p>
            <p><strong>Next Billing:</strong> June 15, 2025</p>
          </div>
          <button className="download-btn">⬇ Download Receipt</button>
        </div>

        <div className="secure-note">
          🔒 Secure Transaction <br />
          Your payment information is encrypted and secure.
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <h2 className="welcome">Welcome to Premium!</h2>

        {/* <FaCheckCircle className="big-check" /> */}
        <h1>Payment Successful! 🎉</h1>
        <p className="subtext">
          Welcome to AstroAura Premium! Your cosmic journey begins now.
        </p>

        <div className="premium-card">
          <h3>🌟 Premium Activated</h3>
          <p className="expiry">Valid until: February 15, 2026</p>
          <div className="features">
            <div>
              <h4>∞</h4>
              <p>Unlimited Readings</p>
            </div>
            <div>
              <h4>24/7</h4>
              <p>AI Support</p>
            </div>
            <div>
              <h4>100+</h4>
              <p>Premium Features</p>
            </div>
          </div>
        </div>

        <button className="chat-btn">✨ Start Chatting with Aura AI</button>

        <div className="actions">
          <button className="secondary">📧 Email Receipt</button>
          <button className="secondary">🤝 Share with Friends</button>
        </div>

        <p className="support">
          Need help? Contact our support team at <span>support@astroaura.ai</span>
        </p>
      </main>
    </div>
  );
};

export default PaymentSuccess;
