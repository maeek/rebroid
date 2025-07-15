export const getAssignedTagForFile = (ext: string) => {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
    case '.png':
    case '.gif':
      return 'image'

    case '.mp4':
    case '.mkv':
    case '.avi':
    case '.mov':
    case '.mp3':
    case '.wav':
    case '.flac':
    case '.ogg':
      return 'media'

    case '.pdf':
    case '.doc':
    case '.docx':
    case '.xls':
    case '.xlsx':
    case '.ppt':
    case '.pptx':
      return 'document'

    case '.zip':
    case '.rar':
    case '.7z':
      return 'archive'

    case '.txt':
    case '.md':
      return 'text'

    case '.html':
    case '.css':
    case '.js':
    case '.ts':
    case '.jsx':
    case '.tsx':
      return 'code'
    default:
      return 'file'
  }
}
