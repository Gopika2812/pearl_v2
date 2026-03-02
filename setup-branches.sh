#!/bin/bash
# Quick script to add branches and users
# Usage: bash setup-branches.sh

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:5000"

echo -e "${YELLOW}🚀 Pearl ERP - Branch & User Setup${NC}\n"

# Function to create branch
create_branch() {
  local name=$1
  local code=$2
  local location=$3
  local phone=$4
  local manager=$5
  
  echo -e "${YELLOW}Creating branch: $name${NC}"
  
  response=$(curl -s -X POST "$API_URL/api/branches" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"$name\",
      \"code\": \"$code\",
      \"location\": \"$location\",
      \"phone\": \"$phone\",
      \"manager\": \"$manager\",
      \"isMainBranch\": false,
      \"status\": \"ACTIVE\"
    }")
  
  # Extract ID
  branch_id=$(echo $response | grep -o '"_id":"[^"]*' | cut -d'"' -f4)
  
  if [ -z "$branch_id" ]; then
    echo -e "${RED}❌ Failed to create branch${NC}"
    echo "Response: $response"
    return
  fi
  
  echo -e "${GREEN}✓ Branch created: $branch_id${NC}\n"
  echo "$branch_id"
}

# Function to create user
create_user() {
  local username=$1
  local password=$2
  local email=$3
  local branch_id=$4
  local role=$5
  
  echo -e "${YELLOW}Creating user: $username${NC}"
  
  response=$(curl -s -X POST "$API_URL/api/branch-users/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"$username\",
      \"password\": \"$password\",
      \"email\": \"$email\",
      \"branchId\": \"$branch_id\",
      \"role\": \"$role\"
    }")
  
  if echo $response | grep -q "\"success\":true"; then
    echo -e "${GREEN}✓ User created: $username${NC}\n"
  else
    echo -e "${RED}❌ Failed to create user${NC}"
    echo "Response: $response\n"
  fi
}

# Main Setup
echo "=== SETUP 1: Main Branch ==="
MAIN_BRANCH_ID=$(create_branch \
  "Pearl Foods & Frozen - Tirunelveli" \
  "PF-TRV" \
  "Tirunelveli" \
  "9429692970" \
  "Ramesh Kumar")

create_user "tirunelveli_admin" "secure@123" "admin@tirunelveli.com" "$MAIN_BRANCH_ID" "ADMIN"
create_user "tirunelveli_manager" "secure@123" "manager@tirunelveli.com" "$MAIN_BRANCH_ID" "MANAGER"

echo "=== SETUP 2: Secondary Branch ==="
SECONDARY_BRANCH_ID=$(create_branch \
  "Pearl Foods & Frozen - Nagercoil" \
  "PF-NGC" \
  "Nagercoil" \
  "9429692971" \
  "Suresh Kumar")

create_user "nagercoil_admin" "secure@123" "admin@nagercoil.com" "$SECONDARY_BRANCH_ID" "ADMIN"
create_user "nagercoil_staff" "secure@123" "staff@nagercoil.com" "$SECONDARY_BRANCH_ID" "STAFF"

echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Branch IDs:"
echo "  Main: $MAIN_BRANCH_ID"
echo "  Secondary: $SECONDARY_BRANCH_ID"
echo ""
echo "Login Credentials:"
echo "  Branch 1: tirunelveli_admin / secure@123"
echo "  Branch 2: nagercoil_admin / secure@123"
