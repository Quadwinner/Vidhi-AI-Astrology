import React, { FC } from "react";
// import { FaComments, FaPhoneAlt } from "react-icons/fa";
import "./AstroConnect.css";
import singlechat from '../assets/singlechat.svg';
import call from '../assets/callIcon.svg'

const AstroConnect: FC = () => {
  return (
    <div className="astro-container">
      <p className="astro-text">
        Connect With An Vidhi AI/ AI Astrologer On Call Or Chat For More
      </p>
      <p className="astro-subtext">Personalised Detailed Predictions.</p>

      <div className="astro-buttons">
        <button className="astro-btn">
            <img src={singlechat} alt="alt" className="astro-icon" />
          Chat with Astrologers
        </button>
        <button className="astro-btn">
            <img src={call} alt="alt" className="astro-icon" />
          Talk To Astrologers
        </button>
      </div>
    </div>
  );
};

export default AstroConnect;
