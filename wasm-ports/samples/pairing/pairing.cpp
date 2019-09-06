#include <libff/algebra/curves/edwards/edwards_pp.hpp>
#include <libff/algebra/curves/alt_bn128/alt_bn128_pp.hpp>
#include <libff/algebra/curves/mnt/mnt4/mnt4_pp.hpp>
#include <libff/algebra/curves/mnt/mnt6/mnt6_pp.hpp>

#include <vector>
#include <stdint.h>
#include <fstream>

using namespace libff;
using namespace std;

template<typename ppT>
Fr<ppT> readElem(vector<uint8_t> vec) {
    Fr<ppT> acc = Fr<ppT>("0");

    for (int i = 0; i < vec.size(); i++) {
        acc *= Fr<ppT>(256);
        acc += Fr<ppT>(vec[i]);
    }

    return acc;
    // return Fr<ppT>::random_element();
}

vector<uint8_t> readBytes(istream &is, int num) {
    vector<char> v;
    v.resize(num);
    for (int i = 0; i < num; i++) {
        v[i] = 0;
    }
    is.read(v.data(), num);
    vector<uint8_t> v2;
    v2.resize(num);
    for (int i = 0; i < num; i++) {
        v2[i] = (uint8_t)v[i];
    }

    return v2;
}

void outputBytes(ostream &os, vector<uint8_t> v) {
    for (auto el : v) os << el;
}

int main(int argc, char **argv) {

    std::ifstream file("input.data", std::ios::binary);

    vector<uint8_t> v1 = readBytes(file, 32);
    vector<uint8_t> v2 = readBytes(file, 32);
    alt_bn128_pp::init_public_params();
    cout << "V1 " << v1 << endl;
    cout << "V2 " << v2 << endl;
    G1<alt_bn128_pp> P = readElem<alt_bn128_pp>(v1) * G1<alt_bn128_pp>::one();
    G2<alt_bn128_pp> Q = readElem<alt_bn128_pp>(v2) * G2<alt_bn128_pp>::one();
    P.print();
    Q.print();
    GT<alt_bn128_pp> ans = alt_bn128_pp::reduced_pairing(P, Q);
    // ans.print();
    auto x = ans.c0.c0.c0.as_bigint();
    x.print();
    x.print_hex();

    std::ofstream ofile("output.data", std::ios::binary);
    gmp_printf("%Nx\n", x.data, x.N);

    vector<uint8_t> ovec(x.N*4);
    for (int i = x.N-1; i >= 0; i--) {
        int a = x.data[i];
        cout << hex << a << endl;
        for (int j = 0; j < 4; j++) {
            ovec[(x.N-1-i)*4 + 4 - j - 1] = (uint8_t)(a&0xff);
            a = a >> 8;
        }
    }

    for (auto el : ovec) cout << hex << (int)el << endl;

    outputBytes(ofile, ovec);

    ofile.close();

    cout << ans.c0.c0.c0.size_in_bits() << ", " << x.N << endl;
}

