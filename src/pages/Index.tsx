import React from 'react';
import { Navigate } from 'react-router-dom';

const Index = () => {
  // Redirect the root path to the login page, as requested by the user.
  return <Navigate to="/login" replace />;
};

export default Index;