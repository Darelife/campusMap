import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contributors - Campus Map",
  description: "The people who built and maintain the BITS Goa Campus Map.",
};

const CONTRIBUTORS_2025_SEM2 = [
  {
    name: "Prakhar Bhandari",
    bitsId: "2023A7PS0458G",
    role: "Website Development & Data Collection",
    description:
      "Built the virtual tour viewer, navigation system, pathfinding engine, and helped in gathering the images.",
    github: "https://github.com/darelife",
  },
  {
    name: "Krish Garg",
    bitsId: "2024A7PS0642G",
    role: "Website Development & Data Collection",
    description:
      "Built the virtual tour viewer, and helped in gathering the images.",
    github: "https://github.com/KrishGarg",
  },
  {
    name: "Arin Roday",
    bitsId: "2023A7PS0456G",
    role: "Website Development & Data Collection",
    description:
      "Built the virtual tour viewer, and helped in gathering the images.",
    github: "https://github.com/arin-r",
  },
  {
    name: "Satvik Jain",
    bitsId: "2024A7PS0595G",
    role: "Website Development & Data Collection",
    description:
      "Built the virtual tour viewer, and helped in gathering the images.",
    github: "https://github.com/salt-vik",
  },
  {
    name: "Raghav Maheshwari",
    bitsId: "2023A7PS0462G",
    role: "Data Collection",
    description: "Helped in gathering the images.",
    github: "https://github.com/RaghavMaheshwari124",
  },
  {
    name: "Shreya Rai",
    bitsId: "2023AAPS1061G",
    role: "Data Collection",
    description: "Helped in gathering the images.",
    github: "https://github.com/shreyAQ",
  },
  {
    name: "Dorothy Mehta",
    bitsId: "2023B1A70714G",
    role: "Data Collection",
    description: "Helped in gathering the images.",
    github: "https://github.com/dr-gitcraft",
  },
  {
    name: "Shivani Panda",
    bitsId: "2024B4A71093G",
    role: "Data Collection",
    description: "Helped in gathering the images.",
    github: "https://github.com/Imaginary2324",
  },
  {
    name: "Jash Jagesh Shah",
    bitsId: "2025AAPS0772G",
    role: "Data Collection",
    description: "Helped in gathering the images.",
    github: "https://github.com/letmebeblank",
  },
  {
    name: "Ankit Sharma",
    bitsId: "",
    role: "Data Collection",
    description: "Helped in gathering the images.",
    github: "",
  },
  {
    name: "Suryansh Ray",
    bitsId: "",
    role: "Data Collection",
    description: "Helped in gathering the images.",
    github: "",
  },
];

export default function ContributorsPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        color: "#333",
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          maxWidth: "700px",
          margin: "0 auto",
          backgroundColor: "#fff",
          padding: "40px",
          border: "1px solid #ccc",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ marginBottom: "20px" }}>
          <Link
            href="/"
            style={{
              color: "#0066cc",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            &larr; Back to Campus Map
          </Link>
        </div>

        <h1 style={{ fontSize: "28px", margin: "0 0 10px 0", color: "#111" }}>
          Contributors
        </h1>
        <p
          style={{
            fontSize: "15px",
            color: "#555",
            margin: "0 0 40px 0",
            lineHeight: "1.6",
          }}
        >
          The BITS Goa Campus Map is an open-source project. Below are the
          contributors who have helped build and improve the map.
        </p>

        <section style={{ marginBottom: "40px" }}>
          <h2
            style={{
              fontSize: "22px",
              borderBottom: "1px solid #ddd",
              paddingBottom: "8px",
              margin: "0 0 20px 0",
              color: "#222",
            }}
          >
            2025-26 Sem 2
          </h2>

          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {CONTRIBUTORS_2025_SEM2.map((c) => (
              <li
                key={c.name}
                style={{
                  margin: "0 0 20px 0",
                  padding: "15px",
                  backgroundColor: "#fafafa",
                  border: "1px solid #eee",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "5px",
                  }}
                >
                  <h3 style={{ margin: "0", fontSize: "18px", color: "#111" }}>
                    {c.name}
                  </h3>
                  <div style={{ fontSize: "13px" }}>
                    {c.bitsId && (
                      <span style={{ color: "#666", marginRight: "10px" }}>
                        {c.bitsId}
                      </span>
                    )}
                    {c.github && (
                      <a
                        href={c.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#0066cc", textDecoration: "none" }}
                      >
                        GitHub Profile
                      </a>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#444",
                    marginBottom: "8px",
                  }}
                >
                  {c.role}
                </div>

                <p
                  style={{
                    margin: "0",
                    fontSize: "14px",
                    color: "#555",
                    lineHeight: "1.5",
                  }}
                >
                  {c.description}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section
          style={{
            marginTop: "40px",
            paddingTop: "20px",
            borderTop: "1px solid #ddd",
          }}
        >
          <h2 style={{ fontSize: "20px", margin: "0 0 15px 0", color: "#222" }}>
            Want to contribute?
          </h2>
          <p
            style={{
              fontSize: "15px",
              color: "#555",
              lineHeight: "1.6",
              margin: "0 0 15px 0",
            }}
          >
            The campus map is open source. If you have 360° photos, can verify
            GPS data, or want to improve the UI, open a pull request!
          </p>
          <a
            href="https://github.com/Darelife/campusMap"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#0066cc",
              textDecoration: "none",
              fontSize: "15px",
            }}
          >
            View on GitHub &rarr;
          </a>
        </section>
      </div>
    </main>
  );
}
