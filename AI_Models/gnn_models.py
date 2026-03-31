import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GINConv, global_mean_pool


def _mlp(input_dim, output_dim):
    return nn.Sequential(
        nn.Linear(input_dim, output_dim),
        nn.ReLU(),
        nn.Linear(output_dim, output_dim),
    )


class ToxGNN(nn.Module):
    def __init__(self, out_dim):
        super().__init__()
        self.conv1 = GINConv(_mlp(7, 512))
        self.conv2 = GINConv(_mlp(512, 512))
        self.conv3 = GINConv(_mlp(512, 512))
        self.lin = nn.Sequential(
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Linear(256, out_dim),
        )

    def forward(self, data):
        x, edge_index, batch = data.x, data.edge_index, data.batch
        x = F.relu(self.conv1(x, edge_index))
        x = F.relu(self.conv2(x, edge_index))
        x = F.relu(self.conv3(x, edge_index))
        x = global_mean_pool(x, batch)
        return self.lin(x)


class ZincGNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = GINConv(_mlp(7, 256))
        self.conv2 = GINConv(_mlp(256, 256))
        self.conv3 = GINConv(_mlp(256, 256))
        self.conv4 = GINConv(_mlp(256, 256))
        self.lin = nn.Sequential(
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 3),
        )

    def forward(self, data):
        x, edge_index, batch = data.x, data.edge_index, data.batch
        x = F.relu(self.conv1(x, edge_index))
        x = F.relu(self.conv2(x, edge_index))
        x = F.relu(self.conv3(x, edge_index))
        x = F.relu(self.conv4(x, edge_index))
        x = global_mean_pool(x, batch)
        return self.lin(x)
