import { createContext, useContext } from "react";

export const AuthContext = createContext(null);

function useAuth() {
  return useContext(AuthContext);
}

export default useAuth;
