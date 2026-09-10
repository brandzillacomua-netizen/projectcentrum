import { Router } from 'express'
import { handleConfirmBufferCutting } from '../controllers/cuttingController.js'

const router = Router()

router.post('/confirm-buffer', handleConfirmBufferCutting)

export default router
