// src/components/Layout.tsx
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

export default function Layout() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: '100px', width: '100%', overflowX: 'hidden' }}>
        <Outlet /> 
      </main>
      <Footer />
    </>
  );
}