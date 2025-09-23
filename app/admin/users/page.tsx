import { requireAdmin } from "@/lib/auth";
import { CardGlass } from "@/components/ui/CardGlass";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Shield, Truck, Search, Filter, MoreHorizontal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-white">User Management</h1>
            <p className="text-slate-300 text-lg">
              Manage user roles and carrier profiles
            </p>
          </div>

          {/* Filters */}
          <CardGlass className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search users by name, MC#, or email..."
                    className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select defaultValue="all">
                  <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="carrier">Carrier</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
              </div>
            </div>
          </CardGlass>

          {/* Users Table */}
          <CardGlass className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Users</h2>
                <div className="flex items-center gap-2 text-slate-300">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">24 total users</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-slate-300">User</TableHead>
                      <TableHead className="text-slate-300">Role</TableHead>
                      <TableHead className="text-slate-300">Carrier Info</TableHead>
                      <TableHead className="text-slate-300">Joined</TableHead>
                      <TableHead className="text-slate-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Mock data for demonstration */}
                    <TableRow className="border-white/10">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-white">John Smith</div>
                          <div className="text-sm text-slate-400">john.smith@example.com</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-400">
                          <Shield className="w-3 h-3 mr-1" />
                          Admin
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm text-slate-300">MC# 123456</div>
                          <div className="text-sm text-slate-400">Smith Logistics LLC</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-300">
                          {formatDistanceToNow(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>

                    <TableRow className="border-white/10">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-white">Sarah Johnson</div>
                          <div className="text-sm text-slate-400">sarah.j@trucking.com</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-400">
                          <Truck className="w-3 h-3 mr-1" />
                          Carrier
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm text-slate-300">MC# 789012</div>
                          <div className="text-sm text-slate-400">Johnson Transport Inc</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-300">
                          {formatDistanceToNow(new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>

                    <TableRow className="border-white/10">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-white">Mike Wilson</div>
                          <div className="text-sm text-slate-400">mike.w@freight.com</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-400">
                          <Truck className="w-3 h-3 mr-1" />
                          Carrier
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm text-slate-300">MC# 345678</div>
                          <div className="text-sm text-slate-400">Wilson Freight Lines</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-300">
                          {formatDistanceToNow(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="text-sm text-slate-400">
                  Showing 1-3 of 24 users
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10" disabled>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </CardGlass>
        </div>
      </div>
    </div>
  );
}
