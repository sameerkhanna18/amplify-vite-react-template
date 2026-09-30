import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main style={{ padding: '40px' }}>
          <h1>Welcome</h1>

          <p>
            Signed in as: {user?.signInDetails?.loginId}
          </p>

          <button onClick={signOut}>
            Sign out
          </button>
        </main>
      )}
    </Authenticator>
  );
}

export default App;
