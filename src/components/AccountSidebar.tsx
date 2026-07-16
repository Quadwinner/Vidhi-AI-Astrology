// src/components/AccountSidebar.tsx
import { IconCreditCard, IconLogout, IconUser, IconWallet } from '@tabler/icons-react';
import { useState } from 'react';
import toast from "react-hot-toast";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './AccountSidebar.module.css';

export default function AccountSidebar() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [activeLink, setActiveLink] = useState('Profile'); 

  const handleSignOutClick = () => {
    const toastId = toast.custom((t) => (
      <div
        style={{
           padding: "16px",
          borderRadius: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          minWidth: "260px",
          border: "2px solid #EC4899",
          background:"#FFF0F3",
          boxShadow: "0 0 20.331px 0 rgba(236, 72, 153, 0.31)",
          position: "relative",
          zIndex: 10001,
        }}
      >
        <p style={{ fontWeight: "600", fontSize: "16px", marginBottom: "12px" , color:"black"}}>
          Are you sure you want to log out?
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
          <button
            onClick={() => {
              signOut(); // trigger actual logout
              toast.dismiss(toastId);
              toast.success("You've been logged out.");
            }}
            style={{
              background: "#EC4899",
              color: "white",
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            Yes, Logout
          </button>
          <button
            onClick={() => toast.dismiss(toastId)}
            style={{
              background: "#ddd",
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    ));
  };

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.settingsMenu}>
        <span className={styles.menuTitle}>Settings Menu</span>
        <ul>
          <li className={activeLink === 'Profile' ? styles.active : ''}>
            <a href="#profiles" onClick={() => setActiveLink('Profile')}>
              <IconUser size={16} />
              <span>Profile Settings</span>
            </a>
          </li>
          <li className={activeLink === 'Wallet' ? styles.active : ''}>
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault();
                setActiveLink('Wallet');
                navigate('/wallet');
              }}
            >
              <IconWallet size={16} />
              <span>Wallet</span>
            </a>
          </li>
          <li className={activeLink === 'Subscription' ? styles.active : ''}>
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault();
                setActiveLink('Subscription');
                navigate('/quick-recharge');
              }}
            >
              <IconCreditCard size={16} />
              <span>Subscription</span>
            </a>
          </li>

          {/* Sign Out with confirmation */}
          <li className={styles.signOutItem}>
            <button onClick={handleSignOutClick}>
              <IconLogout size={16} />
              <span>Sign Out</span>
            </button>
          </li>
        </ul>
      </nav>
    </aside>
  );
}