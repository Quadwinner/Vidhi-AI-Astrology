import React, { FC} from "react";
import "./LoadingDashboard.css";
import foot from "../assets/foot.svg";

const LoadingDashboard: FC = () => {
  

  return (
    <main>
      <div className="loading-container">
        <div className="mandala-animation"></div>
        <div className="loading">
          <p className="loading-msg">
             <h2>Loading DashBoard</h2>
          </p>
          <img src={foot} alt="alt" />
        </div>
      </div>
    </main>
  );
};

export default LoadingDashboard;
