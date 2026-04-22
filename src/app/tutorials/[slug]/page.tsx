import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getArticle } from '@/lib/tutorials-content'
import { TutorialArticleContent } from './TutorialArticleContent'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = getArticle(slug)

  if (!article) {
    return { title: 'Tutorial Not Found' }
  }

  return {
    title: `${article.title} | Lester Labs`,
    description: article.subtitle,
    alternates: { canonical: `https://www.lester-labs.com/tutorials/${slug}` },
    openGraph: {
      title: `${article.title} | Lester Labs`,
      description: article.subtitle,
      url: `https://www.lester-labs.com/tutorials/${slug}`,
      siteName: 'Lester Labs',
      locale: 'en_US',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.subtitle,
    },
  }
}

export default async function TutorialArticlePage({ params }: Props) {
  const { slug } = await params
  const article = getArticle(slug)

  if (!article) {
    notFound()
  }

  return <TutorialArticleContent article={article} />
}
