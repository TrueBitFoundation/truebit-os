
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char **argv) {
    int x = argc;
    void *ptr = malloc(123);
    printf("Args: %d, malloc: %d\n", x, (int)ptr);
    return 0;
}
