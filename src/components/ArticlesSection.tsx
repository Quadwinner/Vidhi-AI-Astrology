import React, { FC, useState, useEffect } from "react";
import "./ArticlesSection.css";
import img1 from "../assets/img1.png";
import img2 from "../assets/img2.png";
import img3 from "../assets/img3.png";
import img4 from "../assets/img4.png";
import img5 from "../assets/img5.png";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import toast from 'react-hot-toast';

interface Article {
  id: number;
  title: string;
  desc: string;
  img: string;
  btn: string;
  tag?: string;
  date?: string;
  path?: string;
}

interface BlogPost {
  id: number;
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  featured_image_url?: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

const articles: Article[] = [
  {
    id: 1,
    title: "Mercury Retrograde 2024: Complete Guide to Navigate the Cosmic Storm",
    desc: "Understanding how Mercury retrograde affects communication, technology, and travel. Learn practical tips to thrive during these celestial challenges and turn cosmic chaos into opportunities for growth. Understanding how Mercury retrograde affects communication, technology, and travel. Learn practical tips to thrive during these celestial challenges and turn cosmic chaos into opportunities for growth.",
    img: img1,
    btn: "Read Full Article",
  },
  {
    id: 2,
    title: "The Fire Signs: Aries, Leo, and Sagittarius Personality Traits",
    desc: "Explore the passionate and dynamic nature of fire signs. Discover their strengths, challenges, and how they navigate relationships and career paths.",
    img: img2,
    btn: "Read More",
    tag: "Zodiac Signs",
    date: "December 15, 2024",
    path: "/FireSigns",
  },
  {
    id: 3,
    title: "Harnessing Full Moon Energy for Manifestation and Release",
    desc: "Learn powerful rituals and practices to align with lunar cycles. Transform your intentions into reality using ancient moon magic wisdom.",
    img: img3,
    btn: "Read More",
    tag: "Moon Phases",
    date: "December 12, 2024",
    path: "/FullMoonBlog",
  },
  {
    id: 4,
    title: "2024 Year-End Predictions: What the Stars Reveal",
    desc: "Discover what the final weeks of 2024 hold for each zodiac sign. Get insights on love, career, and personal growth opportunities.",
    img: img4,
    btn: "Read More",
    tag: "Predictions",
    date: "December 10, 2024",
    path: "/YearEndPredictions"
  },
  {
    id: 5,
    title: "Understanding Planetary Transits and Their Life Impact",
    desc: "Learn how planetary movements influence your daily life, relationships, and major life decisions. Master the art of cosmic timing.",
    img: img5,
    btn: "Read More",
    tag: "Planetary",
    date: "December 8, 2024",
    path: "/PlanetaryTransits"
  },
];

const ArticlesSection: FC = () => {
  const navigate = useNavigate();
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPublishedBlogs();
  }, []);

  const fetchPublishedBlogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('blogs')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBlogPosts(data || []);
    } catch (err: any) {
      console.error('Error fetching published blogs:', err);
      setError('Failed to load blog posts');
      toast.error('Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const handleBlogClick = (slug: string) => {
    navigate(`/blog/${slug}`);
  };

  if (loading) {
    return (
      <div className="articles-wrapper">
        <h1 className="Articles-section-title">Astrology Insights & Wisdom</h1>
        <p className="section-subtitle">Loading the latest cosmic insights...</p>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Use dynamic blogs if available, otherwise fall back to static articles
  const displayContent = blogPosts.length > 0;
  const featuredBlog = displayContent ? blogPosts[0] : null;
  const otherBlogs = displayContent ? blogPosts.slice(1) : null;
  const staticArticles = !displayContent ? articles.slice(1) : null;

  return (
    <div className="articles-wrapper">
      <h1 className="Articles-section-title">Astrology Insights & Wisdom</h1>
      <p className="section-subtitle">
        {displayContent
          ? "Latest insights from our astrology experts - discover what the stars have in store."
          : "Discover the Mysteries of The Cosmos through our expertly crafted articles on astrology, zodiac signs, and celestial guidance."
        }
      </p>

      {error && (
        <div style={{
          backgroundColor: '#fee',
          color: '#c33',
          padding: '10px',
          borderRadius: '5px',
          margin: '20px 0',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      <div className="articles-grid">
        {/* Featured article/blog */}
        {displayContent && featuredBlog ? (
          <div className="articles-card big">
            <img
              src={featuredBlog.featured_image_url || img1}
              alt={featuredBlog.title}
              onClick={() => handleBlogClick(featuredBlog.slug)}
              style={{ cursor: "pointer" }}
            />
            <div className="articles-content">
              <h2
                onClick={() => handleBlogClick(featuredBlog.slug)}
                style={{ cursor: "pointer" }}
              >
                {featuredBlog.title}
              </h2>
              <p>{truncateText(featuredBlog.excerpt || featuredBlog.content, 200)}</p>
              <button onClick={() => handleBlogClick(featuredBlog.slug)} className="card-button">Read Full Article</button>
            </div>
          </div>
        ) : (
          <div className="articles-card big">
            <img src={articles[0].img} alt={articles[0].title} onClick={() => navigate("/BlogPage")}
              style={{ cursor: "pointer" }} />
            <div className="articles-content">
              <h2 onClick={() => navigate("/BlogPage")}
                style={{ cursor: "pointer" }}>{articles[0].title}</h2>
              <p>{articles[0].desc}</p>
              <button onClick={() => navigate("/BlogPage")} className="card-button">{articles[0].btn}</button>
            </div>
          </div>
        )}

        {/* Other articles/blogs */}
        {displayContent && otherBlogs ? (
          otherBlogs.map((blog: BlogPost) => (
            <div className="articles-card" key={blog.id}>
              <img
                src={blog.featured_image_url || img2}
                alt={blog.title}
                onClick={() => handleBlogClick(blog.slug)}
                style={{ cursor: "pointer" }}
              />
              <div className="articles-content">
                <span className="tag">Blog</span>
                <span className="Dates">{formatDate(blog.created_at)}</span>
                <h3
                  onClick={() => handleBlogClick(blog.slug)}
                  style={{ cursor: "pointer" }}
                >
                  {blog.title}
                </h3>
                <p>{truncateText(blog.excerpt || blog.content, 120)}</p>
                <button onClick={() => handleBlogClick(blog.slug)} className="card-button">Read More</button>
              </div>
            </div>
          ))
        ) : null}

        {!displayContent && staticArticles ? (
          staticArticles.map((item: Article) => (
            <div className="articles-card" key={item.id}>
              <img
                src={item.img}
                alt={item.title}
                onClick={() => navigate(item.path!)}
                style={{ cursor: "pointer" }}
              />
              <div className="articles-content">
                {item.tag && <span className="tag">{item.tag}</span>}
                {item.date && <span className="Dates">{item.date}</span>}
                <h3
                  onClick={() => navigate(item.path!)}
                  style={{ cursor: "pointer" }}
                >
                  {item.title}
                </h3>
                <p>{item.desc}</p>
                <button onClick={() => navigate(item.path!)} className="card-button">{item.btn}</button>
              </div>
            </div>
          ))
        ) : null}
      </div>

    </div>
  );
}


export default ArticlesSection;
