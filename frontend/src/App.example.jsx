import ChatWidget from './components/ChatWidget';

/**
 * Minimal example of embedding the widget. In a real site you'd render
 * <ChatWidget /> once near the root of your app (e.g. in App.jsx or a
 * layout component) so it stays mounted across route changes.
 */
export default function App() {
  return (
    <div>
      <h1>Your page content</h1>
      <p>...the rest of your existing site goes here...</p>

      <ChatWidget
        apiBaseUrl='http://localhost:8000/api/assistant'
        title='Ask AI'
        greeting='Hi! Ask me anything about this page.'
        // Optional: scope context extraction to a specific container,
        // e.g. an <article id="docs-content"> on a docs site.
        // contextSelector="#docs-content"
        position='bottom-right'
      />
    </div>
  );
}
