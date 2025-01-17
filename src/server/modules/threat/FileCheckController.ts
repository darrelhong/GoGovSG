import { NextFunction, Request, Response } from 'express'
import { inject, injectable } from 'inversify'

import jsonMessage from '../../util/json'
import { DependencyIds } from '../../constants'
import { FileTypeFilterService, VirusScanService } from './interfaces'
import { logger } from '../../config'

@injectable()
export class FileCheckController {
  private fileTypeFilterService: FileTypeFilterService

  private virusScanService: VirusScanService

  public constructor(
    @inject(DependencyIds.fileTypeFilterService)
    fileTypeFilterService: FileTypeFilterService,
    @inject(DependencyIds.virusScanService)
    virusScanService: VirusScanService,
  ) {
    this.fileTypeFilterService = fileTypeFilterService
    this.virusScanService = virusScanService
  }

  public checkFile: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => Promise<void> = async (req, res, next) => {
    const file = req.files?.file

    if (Array.isArray(file)) {
      res.unprocessableEntity(
        jsonMessage('Only single file uploads are supported.'),
      )
      return
    }

    if (file) {
      if (!(await this.fileTypeFilterService.hasAllowedType(file))) {
        res.unsupportedMediaType(jsonMessage('File type disallowed.'))
        return
      }

      try {
        const hasVirus = await this.virusScanService.hasVirus(file)
        if (hasVirus) {
          const user = req.session?.user
          logger.warn(
            `Malicious file attempt: User ${
              user?.email || user?.id
            } tried to upload ${file.name}`,
          )
          res.badRequest(jsonMessage('File is likely to be malicious.'))
          return
        }
      } catch (error) {
        logger.error('Unable to scan file: ', error)
        res.badRequest(
          jsonMessage('Your file could not be scanned by antivirus software.'),
        )
        return
      }
    }

    next()
  }
}

export default FileCheckController
