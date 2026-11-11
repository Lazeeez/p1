// Original, hand-authored learning material. Each guide is usable without AI.
// Templates illustrate a general-purpose technique, not a solution to a target exercise.
export const STUDY_GUIDES = {
  fundamentals: {
    objective:'Analyze correctness and runtime before optimizing. Learn to articulate a loop invariant and a realistic complexity bound.',
    intuition:'Big O describes how resource use grows as input size grows. A correct linear scan is often better than a clever but unproven shortcut. Count the total work, not the number of loops printed in the source.',
    walkthrough:{title:'Count the actual work',input:'A list of 8 elements. Two pointers begin at opposite ends and each moves inward.',steps:['Define n as the number of items, not the number of variables or lines of code.','Every iteration advances a pointer; neither pointer ever moves backwards.','The loop ends after at most n pointer movements even though it contains multiple branches.','Keep a separate accounting for memory created by the algorithm versus the input itself.'],conclusion:'An invariant and a charging argument establish O(n) time and O(1) extra space.'},
    template:String.raw`def scan_with_invariant(values):
    answer = 0  # State what answer represents.
    for value in values:
        # Before: answer summarizes everything already visited.
        answer += value
        # After: answer summarizes one additional element.
    return answer`,
    complexity:'For a single pass, time is O(n), auxiliary space O(1). A sort typically costs O(n log n) time, and space depends on the sorting algorithm. Nested loops are not automatically quadratic if their pointers progress monotonically.',
    compare:'Separate worst-case, average-case, and amortized analysis. Describe exactly which one you are using. Input constraints can rule out expensive brute-force approaches.',
    mistakes:['Treating recursion depth as free memory','Claiming O(n²) merely because a while loop is nested','Ignoring the cost of slicing, sorting, or copying collections'],
    recall:['What invariant proves that your state summarizes the processed prefix?','How many times can each element enter and leave a monotonic data structure?']
  },
  hashing: {
    objective:'Recognize when membership, frequency, or complement lookups eliminate repeated searching.',
    intuition:'A set answers whether an item has appeared. A dictionary attaches information to an item: an index, count, first position, or best value seen so far. You exchange memory for expected constant-time lookup.',
    walkthrough:{title:'Find duplicates while scanning',input:'Sequence [4, 9, 4, 2].',steps:['Start with an empty set named seen.','Read 4. It is new, so add it to seen. Read 9 and add it.','Read the second 4. It already belongs to seen, so a duplicate is identified immediately.','Observe that the set summarizes the prefix, not the unprocessed suffix.'],conclusion:'No earlier element is scanned twice. Expected O(n) time and O(n) auxiliary space.'},
    template:String.raw`from collections import defaultdict

def frequency_map(values):
    counts = defaultdict(int)
    for value in values:
        counts[value] += 1
    return dict(counts)`,
    complexity:'Building a dictionary or set is O(n) expected time and O(k) space for k distinct keys. An individual lookup is O(1) expected; hostile hash collisions can degrade the worst case.',
    compare:'Use sorting plus two pointers when the data is already ordered or additional space is undesirable. Use a map when original positions or frequency counts matter.',
    mistakes:['Overwriting an earlier index that should be retained','Checking a current element against itself when only prior elements are valid','Assuming hash-map iteration follows sorted key order'],
    recall:['What precisely does your map know after processing index i?','Do you need values, counts, indices, or merely membership?']
  },
  'two-pointers': {
    objective:'Use ordering or monotonic movement to discard impossible candidates without revisiting them.',
    intuition:'Two indices are useful only when moving one has a provable consequence. On sorted data, a comparison can rule out an entire set of pairs rather than one pair at a time.',
    walkthrough:{title:'Reason about a sorted pair',input:'Sorted numbers [1, 3, 5, 8], desired sum 9.',steps:['Place left at 1 and right at 8. Their sum is 9.','If the sum had been too small, reducing right would only make it smaller. Advancing left is the defensible move.','If the sum had been too large, advancing left would make it even larger. Decrease right instead.','After each move, all discarded pairs are provably unable to be the target pair.'],conclusion:'Each pointer moves at most n times: O(n) after any required sort.'},
    template:String.raw`def inspect_sorted_pairs(values):
    left, right = 0, len(values) - 1
    while left < right:
        if values[left] + values[right] < 0:
            left += 1
        else:
            right -= 1
    return left, right`,
    complexity:'Opposite-end scans are O(n) time and O(1) extra space on already sorted input. Sorting a copy first adds O(n log n) time and additional storage.',
    compare:'Unlike sliding window, both pointers need not define a valid contiguous range. Unlike hashing, two pointers often require sorted order.',
    mistakes:['Moving both pointers when only one direction is justified','Forgetting to handle equal values and duplicate pairs','Sorting when the original indices are required without preserving them'],
    recall:['What candidates does each pointer move eliminate?','What property makes it safe to stop when the indices cross?']
  },
  'sliding-window': {
    objective:'Maintain information about a contiguous range while growing and shrinking it.',
    intuition:'Recomputing the state of every substring wastes work. Keep a moving window [left, right] whose summary can be updated when one item enters or leaves.',
    walkthrough:{title:'Longest span with distinct characters',input:'Characters a, b, c, a.',steps:['Expand right through a, b, c, maintaining counts for the current window.','When the fourth character a enters, the window contains a duplicate.','Advance left, removing characters from the counts until the window is valid again.','Record the best window length when the invariant holds.'],conclusion:'Every character enters and exits the window at most once; total pointer movements are O(n).'},
    template:String.raw`def longest_valid_window(items):
    from collections import defaultdict
    counts = defaultdict(int)
    left = best = 0
    for right, item in enumerate(items):
        counts[item] += 1
        while counts[item] > 1:
            counts[items[left]] -= 1
            left += 1
        best = max(best, right - left + 1)
    return best`,
    complexity:'Most expand/shrink windows use O(n) time since each edge advances at most n times, and O(k) state for distinct keys. Fixed-size windows may use O(1) state.',
    compare:'Use prefix sums for arbitrary fixed range-sum queries; use a sliding window when the current range can be maintained incrementally and the validity predicate allows safe shrinking.',
    mistakes:['Failing to remove the outgoing character','Using an ordinary shrinking rule when negative numbers destroy monotonicity','Updating the answer before the window is valid'],
    recall:['What does your window summary represent exactly?','Why can the left edge never need to move backwards?']
  },
  prefix: {
    objective:'Derive range information from accumulated state; handle empty-prefix boundaries correctly.',
    intuition:'When many ranges overlap, their totals share a huge amount of repeated work. Prefix totals encode the accumulated information once. The desired range becomes a difference between two prefixes.',
    walkthrough:{title:'Compute repeated interval sums',input:'Values [2, -1, 4, 3].',steps:['Build prefixes P = [0, 2, 1, 5, 8]; P[0] is the empty prefix.','The sum of indices 1 through 2 is P[3] − P[1] = 3.','Notice the value at index 0 is excluded because it appears in both totals.','To count target-sum subarrays, record how often earlier prefix totals occurred.'],conclusion:'Preprocessing takes O(n), then each interval sum is O(1).'},
    template:String.raw`def build_prefix(values):
    prefix = [0]
    for x in values:
        prefix.append(prefix[-1] + x)
    return prefix

# Half-open interval [left, right):
# total = prefix[right] - prefix[left]`,
    complexity:'A prefix array takes O(n) time/space. With a frequency dictionary, target-sum subarray counting is O(n) expected time and O(n) space.',
    compare:'A sliding window is often more compact when all entries are nonnegative and the condition is monotone. Prefix sums remain useful with negative values.',
    mistakes:['Forgetting prefix[0] = 0','Confusing inclusive with half-open bounds','Using two pointers for target sums when negative inputs invalidate monotonicity'],
    recall:['How would you recover sum(nums[l:r]) in constant time?','Which earlier prefix would form a target-sum range ending now?']
  },
  stack: {
    objective:'Model nested and deferred work using last-in, first-out order.',
    intuition:'The most recently opened item must be resolved first in nested expressions. A stack mirrors this structure directly, without re-searching the entire history.',
    walkthrough:{title:'Check nested delimiters',input:'Opening and closing symbols: ([{}]).',steps:['Push each opening symbol as you encounter it.','On a closing brace, inspect only the most recent unmatched opening symbol.','A correct match pops the stack and restores the previous nesting context.','At the end, the stack must be empty; leftovers mean something never closed.'],conclusion:'Each symbol is pushed/popped once: O(n) time and O(n) worst-case stack space.'},
    template:String.raw`def nesting_depth(tokens):
    stack = []
    deepest = 0
    for token in tokens:
        if token == '(':
            stack.append(token)
            deepest = max(deepest, len(stack))
        elif token == ')':
            if not stack:
                return -1
            stack.pop()
    return deepest if not stack else -1`,
    complexity:'A stack traversal is typically O(n) time and O(n) space in maximum nesting depth. Each append/pop at the list end is amortized O(1).',
    compare:'Queues are first-in first-out and fit breadth-first work; stacks fit recursive backtracking, depth-first work, and nesting.',
    mistakes:['Popping from an empty stack','Failing to reject leftover stack entries','Confusing the top with the earliest unmatched item'],
    recall:['Why must the latest unmatched opening symbol be checked first?','Which state needs restoring after a nested expression closes?']
  },
  'binary-search': {
    objective:'Find a boundary in a monotonic predicate, not merely an exact item in a sorted array.',
    intuition:'Binary search repeatedly discards half the candidate answer space. You need a yes/no property that switches from false to true (or vice versa) exactly once.',
    walkthrough:{title:'Find the first sufficient capacity',input:'Candidate capacities 1..16, feasible only at 11 or above.',steps:['Maintain lo = 1, hi = 17 as a half-open range that contains the first feasible answer.','Probe midpoint 9: infeasible, so the answer must be to the right; set lo = 10.','Probe 13: feasible, so the first feasible answer is no later than 13; set hi = 13.','Repeat until lo == hi. The boundary is 11.'],conclusion:'Only log₂(range) predicate checks are needed, provided feasibility is monotonic.'},
    template:String.raw`def first_true(lo, hi, feasible):
    # [lo, hi) with a known first-true boundary inside.
    while lo < hi:
        mid = lo + (hi - lo) // 2
        if feasible(mid):
            hi = mid
        else:
            lo = mid + 1
    return lo`,
    complexity:'O(log R) feasibility checks for an integer range of size R. Multiply by the cost of one feasibility check; if checking takes O(n), total time is O(n log R).',
    compare:'Use ordinary sorted-array binary search for an exact key; use binary search on the answer when the target is a minimum/maximum feasible threshold.',
    mistakes:['Mixing [lo, hi] and [lo, hi) conventions','Using a predicate that is not monotone','Forgetting the cost of the feasibility check'],
    recall:['Which half can be discarded after a feasible midpoint?','What single invariant states where the first true answer still lies?']
  },
  'linked-list': {
    objective:'Manipulate references safely; use dummy nodes and runner pointers to simplify edge cases.',
    intuition:'A linked list is not an array: you can change connections in constant time once you have a node, but reaching the kth node requires traversal. Save references before rewiring.',
    walkthrough:{title:'Understand a local rewire',input:'Nodes A → B → C.',steps:['Before changing B.next, keep the reference to C in a temporary variable.','Reassigning B.next changes a link; it does not move or copy an entire node.','A dummy node before A can simplify operations that modify the head.','Use a slow and fast pointer when you need relative position or cycle detection.'],conclusion:'Reference changes cost O(1); traversing n nodes still takes O(n).'},
    template:String.raw`class ListNode:
    def __init__(self, val=0, next=None):
        self.val, self.next = val, next

def append_after(node, value):
    following = node.next
    node.next = ListNode(value, following)
    return node.next`,
    complexity:'A single pass is O(n) time and O(1) additional memory if only pointers are used. Recursive manipulation may use O(n) call-stack memory.',
    compare:'Use a dummy head to remove special handling of the first node. Use an array if random indexed access is important.',
    mistakes:['Dropping the remainder of the chain by overwriting next','Missing the empty/single-node cases','Mistaking node identity for node value'],
    recall:['Which pointer must be saved before changing a link?','What does a dummy head simplify?']
  },
  'monotonic-stack': {
    objective:'Resolve next-greater/next-smaller questions in linear total time.',
    intuition:'An unresolved earlier item stays on the stack only while no later value has answered its question. A new item may resolve several older items at once.',
    walkthrough:{title:'Next greater to the right',input:'Values [2, 1, 4].',steps:['At 2, push its index: no greater value has appeared.','At 1, push again because 1 does not resolve 2. The stack now represents decreasing values.','At 4, pop the index for 1, then the index for 2: both have just found their next greater value.','Push 4; it has no known greater value yet.'],conclusion:'Each index is pushed once and popped once, making the total O(n).'},
    template:String.raw`def next_greater_indices(values):
    answer = [-1] * len(values)
    stack = []   # indices with decreasing unresolved values
    for i, value in enumerate(values):
        while stack and values[stack[-1]] < value:
            answer[stack.pop()] = i
        stack.append(i)
    return answer`,
    complexity:'Despite a nested while loop, the total time is O(n) through amortized analysis. Worst-case stack memory is O(n).',
    compare:'Use a monotonic deque when stale elements must be removed from both ends, as in sliding-window maxima.',
    mistakes:['Choosing the wrong strict versus non-strict comparison for duplicate values','Storing only values when distances/indices are required','Forgetting unresolved elements at the end'],
    recall:['What do all indices left on the stack mean?','Why can an element be popped no more than once?']
  },
  trees: {
    objective:'Derive recursive solutions from subtree contracts, and distinguish DFS from BFS.',
    intuition:'A tree problem becomes easier when you assume a function already works for each child. Define clearly what the function returns for an empty tree, then combine child results.',
    walkthrough:{title:'Reason about height',input:'A root with a left subtree of height 2 and right subtree of height 1.',steps:['State the contract: height(node) means the number of nodes on its longest downward path.','Base case: an absent node contributes zero.','Apply the contract to both children independently.','Combine the answers at the current node: 1 + max(2, 1) = 3.'],conclusion:'A correct recursive contract makes the proof local to one node.'},
    template:String.raw`def fold_tree(root):
    if root is None:
        return 0
    left = fold_tree(root.left)
    right = fold_tree(root.right)
    return 1 + left + right  # Example: count nodes`,
    complexity:'A single visit per node is O(n) time. Recursive DFS uses O(h) auxiliary stack space, where h is tree height (up to n for a chain). Level-order BFS uses O(w) queue space.',
    compare:'Use BFS for levels and shortest unweighted routes; DFS for subtree aggregation and recursive path properties. BST order adds a separate global constraint.',
    mistakes:['Defining height in nodes in one place and edges in another','Testing only immediate BST children instead of full value ranges','Forgetting to return values from recursive calls'],
    recall:['What should the recursive call promise to return?','What is the base case for an empty subtree?']
  },
  heaps: {
    objective:'Maintain only the best k candidates when full sorting is wasteful or input streams.',
    intuition:'A min-heap of size k keeps the k largest seen values: the root is the smallest among those winners, so it is the first one to replace when a better value arrives.',
    walkthrough:{title:'Keep the largest two',input:'Stream 5, 1, 9, 7.',steps:['Insert 5 and 1 into a min-heap of capacity two. Root is 1.','When 9 arrives, replace root 1; the retained values are 5 and 9.','When 7 arrives, replace root 5; the heap retains 7 and 9.','The root now identifies the second largest value seen.'],conclusion:'You store k winners, not an entire sorted copy of all items.'},
    template:String.raw`import heapq

def top_k_stream(stream, k):
    heap = []
    for value in stream:
        if len(heap) < k:
            heapq.heappush(heap, value)
        elif value > heap[0]:
            heapq.heapreplace(heap, value)
    return heap  # Heap order is not fully sorted.`,
    complexity:'Maintaining a heap of size k across n items takes O(n log k) time and O(k) space. A single insertion/removal takes O(log k).',
    compare:'Sort when you need the entire ordering once. Use a heap when input arrives incrementally or you only need a small subset of extremes.',
    mistakes:['Assuming a heap is globally sorted','Using negative values inconsistently to simulate max-heaps','Returning arbitrary heap order where sorted output is required'],
    recall:['What does the root represent in a size-k min-heap?','What happens when a new value is worse than the current root?']
  },
  intervals: {
    objective:'Normalize and reason about overlap after ordering endpoints.',
    intuition:'Sorting intervals makes potentially overlapping ranges adjacent. You only need to compare a new interval with the last merged group, not every earlier interval.',
    walkthrough:{title:'Merge overlapping time ranges',input:'Closed ranges [1,3], [2,5], [8,10].',steps:['Sort by start time; they are already ordered.','Start the result with [1,3]. Since 2 ≤ 3, [2,5] overlaps: extend the end to 5.','For [8,10], the start 8 exceeds the previous end 5, so create a new group.','The result represents the union [1,5] and [8,10].'],conclusion:'Sorting dominates at O(n log n); one sweep merges everything in O(n).'},
    template:String.raw`def merge_closed_ranges(ranges):
    merged = []
    for start, end in sorted(ranges):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged`,
    complexity:'Sorting is O(n log n); scanning is O(n). Additional space depends on output storage and whether sorting mutates the input.',
    compare:'For maximum nonoverlapping selection, sorting by END time often supports a different greedy proof than merging by START time.',
    mistakes:['Unspecified closed versus half-open endpoint conventions','Only checking whether an interval starts inside another','Assuming the input is sorted'],
    recall:['When do touching endpoints count as overlapping?','Why is looking only at the last merged interval sufficient?']
  },
  backtracking: {
    objective:'Explore a decision tree with precise state restoration and pruning.',
    intuition:'Backtracking is depth-first search over choices. At each level, choose an option, explore it, then undo your mutation so sibling choices start from identical state.',
    walkthrough:{title:'Enumerate choices',input:'Select a subset from [A, B].',steps:['At A, branch into “include A” and “skip A.”','Within each branch, make the same two choices for B.','At a leaf, record a COPY of the current partial selection.','Undo each appended choice before exploring a different branch.'],conclusion:'The four leaves are {}, {A}, {B}, and {A,B}; nothing is lost or duplicated.'},
    template:String.raw`def enumerate_subsets(values):
    result, path = [], []
    def dfs(index):
        if index == len(values):
            result.append(path.copy())
            return
        dfs(index + 1)  # Skip
        path.append(values[index])
        dfs(index + 1)  # Take
        path.pop()      # Undo
    dfs(0)
    return result`,
    complexity:'Generating all subsets is O(n·2ⁿ) time including copying output and O(n) recursion/path space excluding results. Pruning can reduce explored branches, not the worst-case exponential bound.',
    compare:'DP may collapse overlapping subproblems; backtracking retains explicit paths when every valid configuration must be listed.',
    mistakes:['Forgetting to undo a mutable choice','Appending the same mutable path object repeatedly','Using no deduplication when input elements repeat'],
    recall:['What state must be restored after returning from recursion?','Can you reject a partial path before reaching a leaf?']
  },
  graphs: {
    objective:'Model problems as vertices/edges, traverse systematically, and manage visited state.',
    intuition:'A graph may be explicit (connections in a list) or implicit (cells in a grid, strings transformed by one edit). The key is defining neighbors and preventing duplicate exploration.',
    walkthrough:{title:'BFS reaches nodes by distance',input:'Edges A→B, A→C, B→D.',steps:['Enqueue A and mark it visited when it enters the queue.','Dequeue A; enqueue its unseen neighbors B and C with distance 1.','Dequeue B; enqueue unseen D with distance 2.','Dequeue C and then D. You never rediscover D at a shorter edge count.'],conclusion:'FIFO order makes BFS shortest-path correct for unweighted graphs.'},
    template:String.raw`from collections import deque

def bfs(start, neighbors):
    queue = deque([start])
    seen = {start}
    while queue:
        node = queue.popleft()
        for nxt in neighbors(node):
            if nxt not in seen:
                seen.add(nxt)  # Mark when enqueuing.
                queue.append(nxt)
    return seen`,
    complexity:'With an adjacency list, DFS and BFS each cost O(V+E) time and O(V) visited/queue space. For grid problems, V is rows×columns.',
    compare:'DFS is convenient for components and exhaustive reachability; BFS gives minimum hops when every edge has equal weight.',
    mistakes:['Marking visited only after dequeueing','Not recognizing repeated edges or self-loops','Using DFS to claim an unweighted shortest distance'],
    recall:['What are the nodes and what are their neighbors?','When does a state become visited?']
  },
  toposort: {
    objective:'Order directed dependencies and detect cycles.',
    intuition:'A topological ordering lists each prerequisite before anything that depends on it. Kahn’s algorithm repeatedly takes a node with zero remaining prerequisites.',
    walkthrough:{title:'Schedule dependencies',input:'A before B and C; B before D.',steps:['Count the incoming edges: A has zero; B and C each one; D one.','Emit A, removing its outgoing edges. B and C now have zero indegree.','Emit either B or C next; after B, D is ready.','If the queue empties before all nodes are emitted, a directed cycle prevents completion.'],conclusion:'Multiple correct orders can exist; the count of emitted nodes detects a cycle.'},
    template:String.raw`from collections import deque

def topological_order(n, edges):
    graph = [[] for _ in range(n)]
    indegree = [0] * n
    for before, after in edges:
        graph[before].append(after)
        indegree[after] += 1
    ready = deque(i for i, d in enumerate(indegree) if d == 0)
    result = []
    while ready:
        node = ready.popleft()
        result.append(node)
        for nxt in graph[node]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0: ready.append(nxt)
    return result if len(result) == n else []`,
    complexity:'O(V+E) time and space with adjacency lists and indegree counts.',
    compare:'Topological sorting is for directed acyclic graphs; ordinary BFS does not enforce dependency order, and undirected graphs have no analogous directed prerequisites.',
    mistakes:['Reversing prerequisite edge direction','Ignoring cycles when returned order is incomplete','Assuming topological order is unique'],
    recall:['What does indegree zero mean during the algorithm?','How does the final order length reveal a cycle?']
  },
  'union-find': {
    objective:'Maintain connectivity among changing groups with disjoint-set union.',
    intuition:'Disjoint-set union labels each connected component by a representative root. A union joins two components; find tells whether elements already share one.',
    walkthrough:{title:'Connect small groups',input:'Union(1,2), union(3,4), union(2,4).',steps:['Initially, every element is its own parent/root.','After union(1,2), items 1 and 2 share one representative.','Union(3,4) creates another component.','Union(2,4) merges the two roots, so all four elements are connected.'],conclusion:'Repeated find queries become almost constant amortized time with path compression and union by size.'},
    template:String.raw`class DSU:
    def __init__(self, n):
        self.parent = list(range(n))
        self.size = [1] * n
    def find(self, x):
        while x != self.parent[x]:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x
    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb: return False
        if self.size[ra] < self.size[rb]: ra, rb = rb, ra
        self.parent[rb] = ra
        self.size[ra] += self.size[rb]
        return True`,
    complexity:'With path compression plus union by rank/size, m operations on n elements take O(m·α(n)) amortized time, where α grows extremely slowly. Space is O(n).',
    compare:'DFS/BFS can find existing connected components in one static graph; DSU is attractive when edges are added over time and connectivity is queried repeatedly.',
    mistakes:['Unioning raw nodes rather than their representative roots','Forgetting path compression or size balancing','Attempting easy edge deletions with ordinary DSU'],
    recall:['What does find(x) promise?','Why can union return false when two vertices are already connected?']
  },
  greedy: {
    objective:'Justify locally optimal choices with an exchange argument or maintained invariant.',
    intuition:'Greedy is not simply “take the best-looking option.” It works only if a local decision can be proved safe for at least one globally optimal solution.',
    walkthrough:{title:'Select maximum nonoverlapping meetings',input:'Meetings [1,4], [2,3], [3,5].',steps:['Sort by finishing time: [2,3], [1,4], [3,5].','Choose [2,3] because an earlier finish leaves at least as much room as any later finish.','Skip [1,4] because it overlaps the chosen meeting.','Choose [3,5], which begins when the previous meeting ended.'],conclusion:'The earliest-finish exchange argument allows optimal selection without checking every subset.'},
    template:String.raw`def select_meetings(intervals):
    selected = []
    previous_end = float('-inf')
    for start, end in sorted(intervals, key=lambda x: x[1]):
        if start >= previous_end:
            selected.append((start, end))
            previous_end = end
    return selected`,
    complexity:'Sorting-based greedy solutions commonly take O(n log n) time; the selection scan is O(n). Memory depends on sorting and output size.',
    compare:'If a counterexample to the local choice exists, use DP/backtracking instead. Greedy often depends on sorting by a carefully selected key.',
    mistakes:['Assuming largest/smallest immediate value always wins','Failing to justify why a chosen step cannot hurt an optimum','Sorting by start when an exchange proof needs finish time'],
    recall:['Can an optimal solution be transformed to include your greedy choice?','Which input would disprove your proposed local rule?']
  },
  dp1: {
    objective:'Identify repeated subproblems and derive a correct one-dimensional recurrence.',
    intuition:'Dynamic programming is controlled reuse of previously solved subproblems. Define a state with a precise meaning; identify decisions that lead to it; set base cases; compute in dependency order.',
    walkthrough:{title:'Count steps with moves of 1 or 2',input:'How many distinct step sequences reach position 4?',steps:['Define ways[i] as sequences that end exactly at position i.','Every final move came from i−1 or i−2, so ways[i] = ways[i−1] + ways[i−2].','Base ways[0] = 1: there is one empty sequence. ways[1] = 1.','Compute ways[2] = 2, ways[3] = 3, ways[4] = 5.'],conclusion:'The recurrence turns exponential repeated recursion into linear work.'},
    template:String.raw`def fib_like(n):
    if n < 2: return n
    previous, current = 0, 1
    for _ in range(2, n + 1):
        previous, current = current, previous + current
    return current`,
    complexity:'A recurrence with O(1) transitions for each of n states takes O(n) time; tabulation uses O(n) space or O(1) if only previous states matter.',
    compare:'Memoization is a good first proof of recurrence; bottom-up DP often makes memory reduction and iteration order clearer.',
    mistakes:['Defining a state without a precise meaning','Incorrect empty-prefix/zero-step base case','Overwriting a prior value before all transitions use it'],
    recall:['What does dp[i] mean in one sentence?','Which smaller states determine dp[i]?']
  },
  dp2: {
    objective:'Choose a state with two varying dimensions and fill a dependency-safe table.',
    intuition:'A grid or two-sequence problem may depend on how far you have progressed in two directions. Each cell summarizes a smaller well-defined problem; never fill cells before their dependencies.',
    walkthrough:{title:'Grid path counts',input:'A 3×3 grid, moving only right or down.',steps:['Define ways[r][c] as the number of paths to cell (r,c).','Starting cell (0,0) has one empty path.','Any other cell receives paths from the top and left, if those cells exist.','Fill row by row; the bottom-right count is 6.'],conclusion:'O(rows×cols) states replace enumeration of every possible route.'},
    template:String.raw`def grid_path_counts(rows, cols):
    if not rows or not cols: return 0
    dp = [[0] * cols for _ in range(rows)]
    dp[0][0] = 1
    for r in range(rows):
        for c in range(cols):
            if r == c == 0: continue
            dp[r][c] = (dp[r-1][c] if r else 0) + (dp[r][c-1] if c else 0)
    return dp[-1][-1]`,
    complexity:'For a grid of m by n, O(mn) time and O(mn) storage, reducible to O(n) space when only the previous/current row matters.',
    compare:'For two strings, state may be dp[i][j] over prefixes; carefully interpret insertion/deletion/substitution costs before designing the recurrence.',
    mistakes:['Confusing prefix length i with index i','Using stale data when compressing to one row','Forgetting an obstacle or boundary condition'],
    recall:['What does cell (i,j) represent precisely?','What dependency order ensures every transition reads a completed state?']
  },
  tries: {
    objective:'Reuse common prefixes to support incremental lookup of many words.',
    intuition:'A trie stores words as root-to-node paths of characters. Two words with the same prefix share that path. A node representing a prefix is not necessarily a complete word.',
    walkthrough:{title:'Insert words sharing a prefix',input:'Insert “car” and “cart”.',steps:['Create child nodes c, a, r while inserting “car.”','Mark the node for r as a terminal word node.','Insert “cart”: reuse c→a→r, then create child t.','Mark t as terminal. Now “car” and “cart” are words, while “ca” is only a prefix.'],conclusion:'The terminal marker distinguishes complete words from prefixes with the same path.'},
    template:String.raw`class Trie:
    def __init__(self):
        self.root = {}
    def insert(self, word):
        node = self.root
        for ch in word:
            node = node.setdefault(ch, {})
        node['#end'] = True
    def starts_with(self, prefix):
        node = self.root
        for ch in prefix:
            if ch not in node: return False
            node = node[ch]
        return True`,
    complexity:'Insertion and prefix search are O(L) in word/prefix length L. Memory is proportional to the number of unique prefix nodes, at most the total characters inserted.',
    compare:'Hash sets offer O(1) expected exact-word membership but do not naturally enumerate all words sharing a prefix.',
    mistakes:['Treating any traversable path as a complete word','Forgetting terminal markers','Allocating a full alphabet array when a sparse map is more appropriate'],
    recall:['What does each trie node represent?','How do you distinguish “car” from a mere prefix of “cart”?']
  },
  bits: {
    objective:'Use binary representations and algebraic identities carefully, including language-specific integer behavior.',
    intuition:'A bit mask encodes many yes/no flags in one integer. XOR is addition without carries on each bit: identical values cancel, which creates useful parity invariants.',
    walkthrough:{title:'Track parity with XOR',input:'Values [6, 3, 6, 5, 3].',steps:['Initialize state to 0; XOR each value in sequence.','After 6 and 3, state is 6^3.','A second 6 cancels the first because x^x = 0.','The final 3 also cancels; state is 5, the unpaired value.'],conclusion:'Associativity and cancellation prove the invariant; this relies on exactly paired duplicates.'},
    template:String.raw`def toggle_membership(mask, position):
    return mask ^ (1 << position)

def is_enabled(mask, position):
    return bool(mask & (1 << position))

def remove_flag(mask, position):
    return mask & ~(1 << position)`,
    complexity:'Fixed-width bit operations are often treated as O(1); Python big integers cost more for very large bit lengths. A scan using one integer state is O(n) time.',
    compare:'Use sets for arbitrary objects; use bit masks when the universe is small/integer-indexed and per-flag operations dominate.',
    mistakes:['Assuming XOR works when every repeated value appears three times','Forgetting operator precedence and parentheses','Ignoring negative-number and unbounded-integer shift semantics'],
    recall:['Which XOR identities cancel repeated values?','How would you test whether bit k is set?']
  },
  'shortest-path': {
    objective:'Distinguish unweighted BFS from Dijkstra for nonnegative weighted edges.',
    intuition:'Dijkstra repeatedly finalizes the closest unsettled vertex. A priority queue orders tentative distances, and edge relaxation asks whether a newly discovered route improves the best known total.',
    walkthrough:{title:'Why a smaller tentative distance matters',input:'Edges A→B cost 4, A→C cost 1, C→B cost 1.',steps:['Begin with dist[A]=0 and all other distances infinity.','From A, discover B at 4 and C at 1; push both into a min-heap.','Pop C first (cost 1) and relax C→B, updating B from 4 to 2.','Pop B at cost 2; the stale heap entry (4,B) can later be ignored.'],conclusion:'A greedy extraction is safe because all edge weights are nonnegative.'},
    template:String.raw`import heapq

def dijkstra(graph, start):
    dist = {start: 0}
    heap = [(0, start)]
    while heap:
        cost, node = heapq.heappop(heap)
        if cost != dist.get(node): continue
        for nxt, weight in graph.get(node, []):
            candidate = cost + weight
            if candidate < dist.get(nxt, float('inf')):
                dist[nxt] = candidate
                heapq.heappush(heap, (candidate, nxt))
    return dist`,
    complexity:'Using a binary heap and adjacency lists, O((V+E) log V) is a typical bound and O(V+E) graph/storage plus heap entries. On dense graphs, other implementations may be appropriate.',
    compare:'Use BFS for unweighted edges. Dijkstra cannot safely finalize distances with negative edges; Bellman–Ford handles negative edges and can detect negative cycles.',
    mistakes:['Using a plain FIFO queue when weights differ','Forgetting to ignore stale queue entries','Applying Dijkstra when an edge has negative weight'],
    recall:['Why does the smallest tentative distance become final?','What would a negative edge do to that argument?']
  }
};

export function getStudyGuide(pattern) { return STUDY_GUIDES[pattern] || null; }
