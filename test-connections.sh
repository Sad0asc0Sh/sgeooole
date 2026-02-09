#!/bin/bash

# ====================================
# EkgKala Store - Connection Test Script
# ====================================

echo "🔍 Testing EkgKala Store Connections..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    
    echo -ne "Testing $name... "
    
    if curl -s --fail "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Connected${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed${NC}"
        return 1
    fi
}

# Function to test MongoDB
test_mongodb() {
    echo -ne "Testing MongoDB... "
    
    if mongosh --eval "db.version()" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Connected${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed${NC}"
        echo -e "${YELLOW}  Make sure MongoDB is running: sudo systemctl start mongod${NC}"
        return 1
    fi
}

echo ""
echo -e "${BLUE}1. Database Connection${NC}"
echo "------------------------"
test_mongodb

echo ""
echo -e "${BLUE}2. Backend API${NC}"
echo "---------------"
test_endpoint "Backend Health Check" "http://localhost:5000/api/health"
test_endpoint "Backend Root" "http://localhost:5000/api"

echo ""
echo -e "${BLUE}3. Frontend${NC}"
echo "------------"
test_endpoint "Frontend" "http://localhost:3000"

echo ""
echo -e "${BLUE}4. Admin Panel${NC}"
echo "---------------"
test_endpoint "Admin Panel" "http://localhost:3001"

echo ""
echo -e "${BLUE}5. API Endpoints Test${NC}"
echo "----------------------"
echo "Testing public endpoints..."
test_endpoint "Products API" "http://localhost:5000/api/products"
test_endpoint "Categories API" "http://localhost:5000/api/categories"

echo ""
echo "========================================"
echo -e "${GREEN}Test Complete!${NC}"
echo ""
echo "If any tests failed:"
echo "1. Make sure the service is running"
echo "2. Check the correct port is being used"
echo "3. Review the logs for errors"
echo ""
echo "To run services:"
echo -e "${YELLOW}Backend:${NC} cd ekgkala-backend && npm run dev"
echo -e "${YELLOW}Frontend:${NC} cd frontend && npm run dev"
echo -e "${YELLOW}Admin:${NC} cd admin && npm run dev"
echo "========================================"
