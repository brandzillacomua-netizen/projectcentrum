import { Router } from 'express'
import { handleDeductInventory } from '../controllers/inventoryController.js'

const router = Router()

router.post('/deduct', handleDeductInventory)

export default router
