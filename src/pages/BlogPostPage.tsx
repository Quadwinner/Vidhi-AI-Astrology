import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { IoIosArrowBack } from 'react-icons/io';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';
import BlogCTAs from '../components/BlogCTAs';
import Navbar from '../components/Navbar';
import { supabase } from '../supabaseClient';
import './BlogPostPage.css';

import DefaultBlogImage from '../assets/BlogBackground.png';
const FALLBACK_IMAGE = DefaultBlogImage;

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
  author_name: string;
  read_time_text: string;
  special_tag?: string;
}

const BlogPostPage: React.FC = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [blogPost, setBlogPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      fetchBlogPost(slug);
    } else {
      setError('No blog post specified.');
      setLoading(false);
    }
  }, [slug]);

  const fetchBlogPost = async (postSlug: string) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('blogs')
        .select('*')
        .eq('slug', postSlug)
        .eq('published', true)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          setError('Blog post not found.');
          toast.error('Blog post not found');
        } else {
          throw error;
        }
        return;
      }
      setBlogPost(data);
    } catch (err: any) {
      console.error('Error fetching blog post:', err);
      setError('Failed to load the blog post.');
      toast.error('Failed to load the blog post.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Helper to fix relative paths if they are breaking
  const getImageUrl = (url?: string) => {
    if (!url) return FALLBACK_IMAGE;
    // If it's a full URL (http/https), use it
    if (url.startsWith('http') || url.startsWith('https')) return url;
    // If it's a relative path, ensure it starts from root
    if (!url.startsWith('/')) return `/${url}`;
    return url;
  };

  if (loading) {
    return (
      <div className="astro-aura-container">
        <Navbar />
        <main className="blog-main">
          <div className="status-message">Loading blog post...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="astro-aura-container">
        <Navbar />
        <main className="blog-main">
            <button className="back-to-blog-btn" onClick={() => navigate("/blog")}>
                <IoIosArrowBack size={20} />
                Back to Blog
            </button>
            <div className="status-message error">{error}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="astro-aura-container">
      <Navbar />
      <main className="blog-main">
        {blogPost && (
          <>
            <header className="blog-post-header">
              <button className="back-to-blog-btn" onClick={() => navigate("/blog")}>
                <IoIosArrowBack size={20} />
                Back to Blog
              </button>

              <div className="blog-meta">
                {blogPost.special_tag && (
                    <span className="special-tag">{blogPost.special_tag}</span>
                )}
                {blogPost.special_tag && <span className="dot">•</span>}
                <span>{formatDate(blogPost.created_at)}</span>
                <span className="dot">•</span>
                <span>{blogPost.read_time_text}</span>
                <span className="dot">•</span>
                <span>By {blogPost.author_name}</span>
              </div>

              <h1 className="blog-title">{blogPost.title}</h1>
              <p className="blog-excerpt">{blogPost.excerpt}</p>
            </header>

            {/* FEATURED IMAGE SECTION */}
            <div className="featured-image-wrapper">
              <img 
                src={getImageUrl(blogPost.featured_image_url)} 
                alt={blogPost.title} 
                className="featured-image"
                onError={(e) => {
                  // If the image fails to load, swap it with the fallback
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = FALLBACK_IMAGE;
                }}
              />
            </div>

            <article className="blog-content-dynamic">
              <ReactMarkdown>{blogPost.content}</ReactMarkdown>
            </article>
            
            <BlogCTAs />
          </>
        )}
      </main>
    </div>
  );
};

export default BlogPostPage;