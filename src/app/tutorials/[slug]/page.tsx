import { notFound } from 'next/navigation'
import { getArticle } from '@/lib/tutorials-content'
import { TutorialArticleContent } from './TutorialArticleContent'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function TutorialArticlePage({ params }: Props) {
  const { slug } = await params
  const article = getArticle(slug)

  if (!article) {
    notFound()
  }

  return <TutorialArticleContent article={article} />
}
