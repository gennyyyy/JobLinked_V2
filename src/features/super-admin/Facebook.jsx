import { useState, useEffect } from "react";
import { getIntegration, saveIntegration, disconnectIntegration, setAutoPost, listPosts, updatePost, buildPostText } from "../../services/facebook";
import { listAllJobs } from "../../services/admin";
import LoadingScreen from "../../components/LoadingScreen";

function Facebook() {
  const [integration, setIntegration] = useState(null);
  const [posts, setPosts] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ pageId: "", pageName: "", accessToken: "" });
  const [previewJob, setPreviewJob] = useState(null);

  useEffect(() => {
    Promise.all([getIntegration(), listPosts(), listAllJobs({ status: "published" })])
      .then(([integ, p, j]) => {
        setIntegration(integ);
        setPosts(p);
        setJobs(j);
        if (integ) {
          setForm({ pageId: integ.page_id, pageName: integ.page_name, accessToken: integ.access_token });
        }
      })
      .catch((err) => setError(err.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <div className="py-8 text-center text-sm text-danger">{error}</div>;

  async function handleConnect(e) {
    e.preventDefault();
    try {
      await saveIntegration({ ...form, autoPost: true });
      setIntegration(await getIntegration());
      setSuccess("Facebook page connected");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDisconnect() {
    await disconnectIntegration();
    setIntegration(null);
  }

  async function handleToggleAutoPost() {
    if (!integration) return;
    await setAutoPost(!integration.auto_post);
    setIntegration({ ...integration, auto_post: !integration.auto_post });
  }

  async function handleRetryPost(post) {
    await updatePost(post.id, { status: "pending", retry_count: post.retry_count + 1 });
    setPosts(await listPosts());
  }

  const previewText = previewJob ? buildPostText(previewJob) : "";

  return (
    <div className="space-y-6 bg-gray-50">
      <header>
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-primary rounded-full" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary uppercase">FACEBOOK INTEGRATION</p>
        </div>
        <h1 className="mt-1 font-sans text-xl md:text-2xl font-bold tracking-tight text-dark-blue">Facebook Auto-Posting</h1>
        <p className="mt-2 text-sm text-gray-500">Connect PESO Facebook page for automatic job posting</p>
      </header>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">{success}</div>
      )}

      <section className="bg-white border border-primary rounded-lg p-5">
        <h2 className="text-lg font-semibold text-dark-blue mb-4">Page Connection</h2>
        {integration ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-900">{integration.page_name}</p>
                <p className="text-xs text-gray-500">Page ID: {integration.page_id}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-mono text-[10px] px-2.5 py-0.5 rounded-full uppercase border ${
                  integration.status === "connected" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-100 border-gray-200 text-gray-500"
                }`}>
                  {integration.status}
                </span>
                <button onClick={handleDisconnect} className="text-xs text-danger hover:underline">Disconnect</button>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-900">Auto-posting</p>
                <p className="text-xs text-gray-500">Automatically post published jobs to Facebook</p>
              </div>
              <button
                onClick={handleToggleAutoPost}
                className={`w-11 h-6 rounded-full transition-colors relative ${integration.auto_post ? "bg-primary" : "bg-gray-300"}`}
              >
                <span className="absolute top-0.5 left-5 w-5 h-5 bg-white rounded-full shadow" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-2">Page ID</label>
              <input type="text" value={form.pageId} onChange={(e) => setForm({ ...form, pageId: e.target.value })} placeholder="Facebook Page ID" className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Page Name</label>
              <input type="text" value={form.pageName} onChange={(e) => setForm({ ...form, pageName: e.target.value })} placeholder="e.g. PESO Santa Maria" className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Access Token</label>
              <input type="password" value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} placeholder="Page access token" className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30" />
            </div>
            <button type="submit" className="px-6 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors">Connect Page</button>
          </form>
        )}
      </section>

      <section className="bg-white border border-primary rounded-lg p-5">
        <h2 className="text-lg font-semibold text-dark-blue mb-4">Post Preview</h2>
        <div className="mb-4">
          <select
            value={previewJob?.id || ""}
            onChange={(e) => setPreviewJob(jobs.find((j) => j.id === e.target.value) || null)}
            className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 text-gray-900 rounded-lg focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
          >
            <option value="">Select a job to preview...</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        </div>
        {previewText && (
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <p className="text-sm text-gray-700 whitespace-pre-line">{previewText}</p>
          </div>
        )}
      </section>

      <section className="bg-white border border-primary rounded-lg p-5">
        <h2 className="text-lg font-semibold text-dark-blue mb-4">Post History ({posts.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 font-mono text-[10px] tracking-widest text-gray-500 uppercase">
                <th className="text-left py-3 px-4 font-medium">Job</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-left py-3 px-4 font-medium">Posted At</th>
                <th className="text-right py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900 font-medium">{post.job?.title}</td>
                  <td className="py-3 px-4">
                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full uppercase border ${
                      post.status === "posted" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : post.status === "failed" ? "bg-danger/10 border-danger/20 text-danger"
                      : "bg-amber-50 border-amber-200 text-amber-700"
                    }`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">{post.posted_at ? new Date(post.posted_at).toLocaleDateString() : "—"}</td>
                  <td className="py-3 px-4 text-right">
                    {post.status === "failed" && (
                      <button onClick={() => handleRetryPost(post)} className="text-xs text-primary hover:underline">Retry</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {posts.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400">No posts yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

export default Facebook;
