import { Redirect } from 'expo-router';

// Email links land here; AuthContext consumes the tokens from the URL.
export default function AuthCallback() {
  return <Redirect href="/" />;
}
